import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { ClinicalPromise, PromiseStatus } from "./promises/types.js";
import { extractPromisesTool } from "./tools/extract-promises.js";
import { checkPromisesTool } from "./tools/check-promises.js";
import { generateTasksTool } from "./tools/generate-tasks.js";
import { getPromiseSummaryTool } from "./tools/get-promise-summary.js";

const port = Number(process.env.PORT ?? "3000");
const TOOL_DEFINITIONS = [
  {
    name: "extract_promises",
    description:
      "Analyzes a clinical note to extract implicit and explicit clinical commitments (follow-up labs, appointments, imaging). Uses AI to identify promises that may not have corresponding orders.",
    inputSchema: {
      type: "object",
      properties: {
        patientId: { type: "string", description: "FHIR Patient ID. If omitted, uses X-Patient-ID header." },
        documentReferenceId: {
          type: "string",
          description: "FHIR DocumentReference ID to fetch and analyze.",
        },
        noteText: { type: "string", description: "Raw clinical note text to analyze." },
        noteDate: { type: "string", format: "date", description: "Date of the clinical note (ISO format)." },
      },
      required: ["noteDate"],
    },
  },
  {
    name: "check_promises",
    description:
      "Verifies extracted clinical promises against FHIR data to determine if each promise has been kept, is pending, or was missed.",
    inputSchema: {
      type: "object",
      properties: {
        patientId: { type: "string", description: "FHIR Patient ID." },
        promises: {
          type: "array",
          items: { type: "object" },
          description: "Array of ClinicalPromise objects from extract_promises.",
        },
      },
      required: ["promises"],
    },
  },
  {
    name: "generate_tasks",
    description: "Creates draft FHIR Task resources for unkept clinical promises for clinician review.",
    inputSchema: {
      type: "object",
      properties: {
        patientId: { type: "string", description: "FHIR Patient ID." },
        unkeptPromises: {
          type: "array",
          items: { type: "object" },
          description: "Array of unkept PromiseStatus objects.",
        },
        writeback: { type: "boolean", default: false, description: "If true, POST Tasks to the FHIR server." },
      },
      required: ["unkeptPromises"],
    },
  },
  {
    name: "get_promise_summary",
    description:
      "End-to-end promise analysis: analyzes clinical notes to extract promises, checks fulfillment against FHIR data, returns summary with action items. Pass notes directly for best results.",
    inputSchema: {
      type: "object",
      properties: {
        patientId: { type: "string", description: "FHIR Patient ID." },
        lookbackDays: { type: "number", default: 90, description: "How far back to search for clinical notes." },
        notes: {
          type: "array",
          items: {
            type: "object",
            properties: {
              noteText: { type: "string", description: "The clinical note text." },
              noteDate: { type: "string", description: "Date of the note (YYYY-MM-DD)." },
            },
            required: ["noteText", "noteDate"],
          },
          description: "Clinical notes to analyze directly. Use this when note text is already available from GetPatientDocuments.",
        },
      },
    },
  },
] as const;

function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  res.statusCode = status;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(payload));
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
    req.on("error", reject);
  });
}

function buildHeadersForTools(req: IncomingMessage): Record<string, string | string[] | undefined> {
  const headers: Record<string, string | string[] | undefined> = { ...req.headers };
  if (!headers["x-patient-id"] && headers["x-inc-sd"]) {
    headers["x-patient-id"] = headers["x-inc-sd"];
  }
  return headers;
}

type JsonRpcRequest = {
  jsonrpc: string;
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
};

async function handleToolCall(
  toolName: string,
  args: Record<string, unknown>,
  headers: Record<string, string | string[] | undefined>
): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
  const extra = { requestInfo: { headers } };

  try {
    switch (toolName) {
      case "extract_promises":
        return await extractPromisesTool(
          args as { patientId?: string; documentReferenceId?: string; noteText?: string; noteDate?: string },
          extra
        );
      case "check_promises":
        return await checkPromisesTool(args as { patientId?: string; promises?: ClinicalPromise[] }, extra);
      case "generate_tasks":
        return await generateTasksTool(
          args as { patientId?: string; unkeptPromises?: PromiseStatus[]; writeback?: boolean },
          extra
        );
      case "get_promise_summary":
        return await getPromiseSummaryTool(
          args as { patientId?: string; lookbackDays?: number; notes?: Array<{ noteText: string; noteDate: string }> },
          extra
        );
      default:
        return { content: [{ type: "text", text: `Unknown tool: ${toolName}` }], isError: true };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[${toolName}] Unhandled error:`, message);
    return { content: [{ type: "text", text: `${toolName} failed: ${message}` }], isError: true };
  }
}

async function handleMcpPost(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = await readBody(req);

  let message: JsonRpcRequest;
  try {
    message = JSON.parse(body) as JsonRpcRequest;
  } catch {
    sendJson(res, 400, { jsonrpc: "2.0", error: { code: -32700, message: "Parse error" }, id: null });
    return;
  }

  console.log(`MCP method: ${message.method}, id: ${message.id}`);
  const headers = buildHeadersForTools(req);

  switch (message.method) {
    case "initialize":
      sendJson(res, 200, {
        jsonrpc: "2.0",
        id: message.id,
        result: {
          protocolVersion: "2025-03-26",
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: "clinical-promise-keeper", version: "0.1.0" },
        },
      });
      return;
    case "notifications/initialized":
      res.statusCode = 204;
      res.end();
      return;
    case "tools/list":
      sendJson(res, 200, { jsonrpc: "2.0", id: message.id, result: { tools: TOOL_DEFINITIONS } });
      return;
    case "tools/call": {
      const params = (message.params ?? {}) as { name?: string; arguments?: Record<string, unknown> };
      const toolName = params.name;
      const toolArgs = params.arguments ?? {};
      if (!toolName) {
        sendJson(res, 200, {
          jsonrpc: "2.0",
          id: message.id,
          error: { code: -32602, message: "Invalid params: missing tool name" },
        });
        return;
      }
      console.log(`Calling tool: ${toolName}, args: ${JSON.stringify(toolArgs).slice(0, 200)}`);
      console.log(`Headers available: ${Object.keys(headers).filter((h) => h.startsWith("x-")).join(", ")}`);
      const result = await handleToolCall(toolName, toolArgs, headers);
      sendJson(res, 200, { jsonrpc: "2.0", id: message.id, result });
      return;
    }
    default:
      sendJson(res, 200, {
        jsonrpc: "2.0",
        id: message.id,
        error: { code: -32601, message: `Method not found: ${message.method}` },
      });
      return;
  }
}

async function start(): Promise<void> {
  const httpServer = createServer(async (req, res) => {
    const method = req.method ?? "GET";
    const path = req.url ? new URL(req.url, "http://localhost").pathname : "/";
    const xHeaders = Object.keys(req.headers)
      .filter((headerName) => headerName.startsWith("x-"))
      .join(", ");

    console.log(`${method} ${path} — all x-headers: ${xHeaders}`);

    try {
      if (method === "GET" && path === "/health") {
        sendJson(res, 200, {
          status: "ok",
          name: "clinical-promise-keeper",
          version: "0.1.0",
        });
        return;
      }

      if (path === "/mcp" && method === "POST") {
        await handleMcpPost(req, res);
        return;
      }

      if (path === "/mcp" && method === "GET") {
        res.statusCode = 200;
        res.setHeader("content-type", "text/event-stream");
        res.setHeader("cache-control", "no-cache");
        res.setHeader("connection", "keep-alive");
        setTimeout(() => res.end(), 30000);
        return;
      }

      if (path === "/mcp" && method === "DELETE") {
        res.statusCode = 204;
        res.end();
        return;
      }

      sendJson(res, 404, { error: "Not found" });
    } catch (error) {
      console.error("Request error:", error);
      sendJson(res, 500, { error: "Internal server error" });
    }
  });

  httpServer.listen(port, () => {
    console.log(`clinical-promise-keeper listening on port ${port}`);
  });
}

start().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
