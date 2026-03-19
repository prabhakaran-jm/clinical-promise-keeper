import { Buffer } from "node:buffer";
import { FhirClient } from "../fhir/client.js";
import { extractPromises } from "../promises/extractor.js";
import { getContext } from "../sharp/context.js";

type ExtractPromisesInput = {
  patientId?: string;
  documentReferenceId?: string;
  noteText?: string;
  noteDate?: string;
};

type ToolResponse = { content: Array<{ type: "text"; text: string }> };

type ToolExtra = {
  requestInfo?: {
    headers: Record<string, string | string[] | undefined>;
  };
};

type FhirDocumentReference = {
  id?: string;
  content?: Array<{
    attachment?: {
      data?: string;
      title?: string;
      url?: string;
    };
  }>;
  description?: string;
  date?: string;
};

function decodeBase64ToText(input?: string): string | undefined {
  if (!input) {
    return undefined;
  }
  try {
    return Buffer.from(input, "base64").toString("utf-8");
  } catch {
    return undefined;
  }
}

async function resolveNoteText(
  contextHeaders: Record<string, string | string[] | undefined>,
  input: ExtractPromisesInput
): Promise<{ noteText: string; sourceDocumentId?: string }> {
  if (input.noteText) {
    return { noteText: input.noteText.trim(), sourceDocumentId: "provided-note" };
  }

  if (!input.documentReferenceId) {
    throw new Error("Either noteText or documentReferenceId is required.");
  }

  const context = getContext(contextHeaders);
  const fhir = new FhirClient(context);
  const doc = await fhir.read<FhirDocumentReference>("DocumentReference", input.documentReferenceId);

  const attachment = doc.content?.[0]?.attachment;
  const fromData = decodeBase64ToText(attachment?.data);
  const fromDescription = doc.description?.trim();

  const noteText = fromData ?? fromDescription;
  if (!noteText) {
    throw new Error("DocumentReference does not contain extractable note text.");
  }

  return {
    noteText,
    sourceDocumentId: doc.id ?? input.documentReferenceId,
  };
}

export async function extractPromisesTool(
  input: ExtractPromisesInput,
  extra?: ToolExtra
): Promise<ToolResponse> {
  try {
    if (!input.noteDate) {
      throw new Error("noteDate is required.");
    }

    const headers = extra?.requestInfo?.headers ?? {};
    const context = getContext(headers);
    const patientId = input.patientId ?? context.patientId;
    if (!patientId) {
      throw new Error("patientId is required (provide it in input or via X-Patient-ID header).");
    }
    const resolved = await resolveNoteText(headers, input);

    const promises = await extractPromises(resolved.noteText, input.noteDate, patientId);
    const output = promises.map((promise) => ({
      ...promise,
      sourceDocumentId: resolved.sourceDocumentId ?? promise.sourceDocumentId,
    }));

    return {
      content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: "text", text: `extract_promises failed: ${message}` }],
    };
  }
}
