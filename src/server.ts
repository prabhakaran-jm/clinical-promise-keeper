import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

type ToolResponse = {
  content: Array<{ type: "text"; text: string }>;
};

const NOT_IMPLEMENTED_RESPONSE: ToolResponse = {
  content: [{ type: "text", text: "Not implemented yet" }],
};

const extractPromisesSchema = {
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

const checkPromisesSchema = {
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

const generateTasksSchema = {
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

const getPromiseSummarySchema = {
  type: "object",
  properties: {
    patientId: {
      type: "string",
      description: "FHIR Patient ID. If omitted, uses X-Patient-ID header.",
    },
    lookbackDays: {
      type: "number",
      default: 90,
      description: "How far back to search for clinical notes (in days).",
    },
  },
} as const;

function registerToolStub(
  server: McpServer,
  name: string,
  description: string,
  inputSchema: unknown
): void {
  const handler = async (): Promise<ToolResponse> => NOT_IMPLEMENTED_RESPONSE;
  (server as unknown as {
    registerTool: (
      toolName: string,
      config: { description: string; inputSchema: unknown },
      callback: () => Promise<ToolResponse>
    ) => void;
  }).registerTool(
    name,
    {
      description,
      inputSchema,
    },
    handler
  );
}

export function createMcpServer(): McpServer {
  const server = new McpServer(
    {
      name: "clinical-promise-keeper",
      version: "0.1.0",
    },
    {
      capabilities: {
        experimental: {
          fhir_context_required: { value: true },
        },
      },
    }
  );

  registerToolStub(
    server,
    "extract_promises",
    "Analyzes a clinical note to extract implicit and explicit clinical commitments (follow-up labs, appointments, imaging). Uses AI to identify promises that may not have corresponding orders.",
    extractPromisesSchema
  );

  registerToolStub(
    server,
    "check_promises",
    "Verifies extracted clinical promises against FHIR data. Checks ServiceRequests, Observations, Appointments, and DiagnosticReports to determine if each promise has been kept.",
    checkPromisesSchema
  );

  registerToolStub(
    server,
    "generate_tasks",
    "Creates draft FHIR Task resources for unkept clinical promises. Tasks are returned as JSON (not written to the FHIR server) for clinician review.",
    generateTasksSchema
  );

  registerToolStub(
    server,
    "get_promise_summary",
    "End-to-end promise analysis for a patient. Fetches recent clinical notes, extracts promises, checks fulfillment, and returns a structured summary with action items.",
    getPromiseSummarySchema
  );

  return server;
}
