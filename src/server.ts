/**
 * MCP Server definition using @modelcontextprotocol/sdk.
 *
 * NOTE: The active HTTP entry point is src/index.ts which handles JSON-RPC
 * directly.  This module is retained so the project can be wired to the
 * official MCP SDK transport in the future (e.g. stdio, or when Prompt
 * Opinion supports session-based Streamable HTTP).
 *
 * Tool schemas defined here are the canonical source and are mirrored in
 * the TOOL_DEFINITIONS constant inside src/index.ts.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { extractPromisesTool } from "./tools/extract-promises.js";
import { checkPromisesTool } from "./tools/check-promises.js";
import { generateTasksTool } from "./tools/generate-tasks.js";
import { getPromiseSummaryTool } from "./tools/get-promise-summary.js";

type ToolResponse = {
  content: Array<{ type: "text"; text: string }>;
};

// ---------------------------------------------------------------------------
// Canonical tool input schemas (Section 8 of PRD)
// ---------------------------------------------------------------------------

export const extractPromisesSchema = {
  type: "object",
  properties: {
    patientId: {
      type: "string",
      description: "FHIR Patient ID. If omitted, uses X-Patient-ID header.",
    },
    documentReferenceId: {
      type: "string",
      description: "FHIR DocumentReference ID to fetch and analyze. Mutually exclusive with noteText.",
    },
    noteText: {
      type: "string",
      description: "Raw clinical note text to analyze. Mutually exclusive with documentReferenceId.",
    },
    noteDate: {
      type: "string",
      format: "date",
      description: "Date of the clinical note (ISO format). Required for timeframe calculation.",
    },
  },
  required: ["noteDate"],
} as const;

export const checkPromisesSchema = {
  type: "object",
  properties: {
    patientId: {
      type: "string",
      description: "FHIR Patient ID.",
    },
    promises: {
      type: "array",
      items: { type: "object" },
      description: "Array of ClinicalPromise objects to verify (output from extract_promises).",
    },
  },
  required: ["promises"],
} as const;

export const generateTasksSchema = {
  type: "object",
  properties: {
    patientId: {
      type: "string",
      description: "FHIR Patient ID.",
    },
    unkeptPromises: {
      type: "array",
      items: { type: "object" },
      description:
        "Array of unkept PromiseStatus objects (output from check_promises, filtered to status=unkept).",
    },
    writeback: {
      type: "boolean",
      default: false,
      description:
        "If true, POST Tasks to the FHIR server. If false (default), return as draft JSON.",
    },
  },
  required: ["unkeptPromises"],
} as const;

export const getPromiseSummarySchema = {
  type: "object",
  properties: {
    patientId: {
      type: "string",
      description: "FHIR Patient ID. If omitted, uses X-Patient-ID header.",
    },
    lookbackDays: {
      type: "number",
      default: 90,
      description: "How far back to search for clinical notes (in days). Used only when notes are not provided.",
    },
    notes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          noteText: { type: "string", description: "The clinical note text." },
          noteDate: { type: "string", format: "date", description: "Date of the note (ISO format)." },
        },
        required: ["noteText", "noteDate"],
      },
      description:
        "Clinical notes to analyze directly. If provided, skips FHIR DocumentReference search. Use this to pass notes obtained from GetPatientDocuments or other sources.",
    },
  },
} as const;

// ---------------------------------------------------------------------------
// Server factory
// ---------------------------------------------------------------------------

type RegisterToolFn = (
  toolName: string,
  config: { description: string; inputSchema: unknown },
  callback: (args: unknown, extra: unknown) => Promise<ToolResponse>
) => void;

function reg(server: McpServer): RegisterToolFn {
  return (server as unknown as { registerTool: RegisterToolFn }).registerTool.bind(server);
}

export function createMcpServer(): McpServer {
  const server = new McpServer(
    { name: "clinical-promise-keeper", version: "0.1.0" },
    {
      capabilities: {
        experimental: { fhir_context_required: { value: true } },
      },
    }
  );

  const register = reg(server);

  register(
    "extract_promises",
    {
      description:
        "Analyzes a clinical note to extract implicit and explicit clinical commitments (follow-up labs, appointments, imaging). Uses AI to identify promises that may not have corresponding orders.",
      inputSchema: extractPromisesSchema,
    },
    async (args, extra) =>
      extractPromisesTool(
        (args ?? {}) as { patientId?: string; documentReferenceId?: string; noteText?: string; noteDate?: string },
        extra as { requestInfo?: { headers: Record<string, string | string[] | undefined> } }
      )
  );

  register(
    "check_promises",
    {
      description:
        "Verifies extracted clinical promises against FHIR data. Checks ServiceRequests, Observations, Appointments, and DiagnosticReports to determine if each promise has been kept.",
      inputSchema: checkPromisesSchema,
    },
    async (args, extra) =>
      checkPromisesTool(
        (args ?? {}) as { patientId?: string; promises?: import("./promises/types.js").ClinicalPromise[] },
        extra as { requestInfo?: { headers: Record<string, string | string[] | undefined> } }
      )
  );

  register(
    "generate_tasks",
    {
      description:
        "Creates draft FHIR Task resources for unkept clinical promises. Tasks are returned as JSON (not written to the FHIR server) for clinician review.",
      inputSchema: generateTasksSchema,
    },
    async (args, extra) =>
      generateTasksTool(
        (args ?? {}) as { patientId?: string; unkeptPromises?: import("./promises/types.js").PromiseStatus[]; writeback?: boolean },
        extra as { requestInfo?: { headers: Record<string, string | string[] | undefined> } }
      )
  );

  register(
    "get_promise_summary",
    {
      description:
        "End-to-end promise analysis for a patient. Fetches recent clinical notes, extracts promises, checks fulfillment, and returns a structured summary with action items.",
      inputSchema: getPromiseSummarySchema,
    },
    async (args, extra) =>
      getPromiseSummaryTool(
        (args ?? {}) as { patientId?: string; lookbackDays?: number; notes?: Array<{ noteText: string; noteDate: string }> },
        extra as { requestInfo?: { headers: Record<string, string | string[] | undefined> } }
      )
  );

  return server;
}
