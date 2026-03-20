import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpServer } from "./server.js";
import { runWithHeaders } from "./sharp/request-context.js";

const port = Number(process.env.PORT ?? "3000");
const transports = new Map<string, StreamableHTTPServerTransport>();

const sendJson = (res: ServerResponse, status: number, payload: unknown): void => {
  res.statusCode = status;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(payload));
};

async function handleMcpRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const sessionIdHeader = req.headers["mcp-session-id"];
  const sessionId = Array.isArray(sessionIdHeader) ? sessionIdHeader[0] : sessionIdHeader;

  if (sessionId && transports.has(sessionId)) {
    const existingTransport = transports.get(sessionId);
    if (existingTransport) {
      await runWithHeaders(req.headers as Record<string, string | string[] | undefined>, () =>
        existingTransport.handleRequest(req, res)
      );
      return;
    }
  }

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
  });

  transport.onclose = () => {
    for (const [id, activeTransport] of transports.entries()) {
      if (activeTransport === transport) {
        transports.delete(id);
        break;
      }
    }
  };

  const server = createMcpServer();
  await server.connect(transport);

  await runWithHeaders(req.headers as Record<string, string | string[] | undefined>, () =>
    transport.handleRequest(req, res)
  );

  const assignedSessionId = res.getHeader("mcp-session-id");
  if (typeof assignedSessionId === "string" && assignedSessionId.length > 0) {
    transports.set(assignedSessionId, transport);
  }
}

async function start(): Promise<void> {
  const httpServer = createServer(async (req, res) => {
    const method = req.method ?? "GET";
    const path = req.url ? new URL(req.url, "http://localhost").pathname : "/";
    const xHeaders = Object.keys(req.headers)
      .filter((headerName) => headerName.startsWith("x-"))
      .join(", ");

    console.log(`${method} ${path} — headers: ${xHeaders}`);

    try {
      if (method === "GET" && path === "/health") {
        sendJson(res, 200, {
          status: "ok",
          name: "clinical-promise-keeper",
          version: "0.1.0",
        });
        return;
      }

      if (path === "/mcp" && (method === "GET" || method === "POST" || method === "DELETE")) {
        await handleMcpRequest(req, res);
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
