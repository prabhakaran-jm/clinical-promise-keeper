import { Buffer } from "node:buffer";
import { FhirClient } from "../fhir/client.js";
import { findDocumentReferences } from "../fhir/queries.js";
import { extractPromises } from "../promises/extractor.js";
import { checkPromises } from "../promises/checker.js";
import { generateTasks, generateCommunicationRequests } from "../tasks/generator.js";
import { getContext } from "../sharp/context.js";
import type { ClinicalPromise } from "../promises/types.js";

type NoteInput = {
  noteText: string;
  noteDate: string;
};

type SummaryInput = {
  patientId?: string;
  lookbackDays?: number;
  notes?: NoteInput[];
};

type ToolExtra = {
  requestInfo?: {
    headers: Record<string, string | string[] | undefined>;
  };
};

function decodeBase64(input?: string): string | undefined {
  if (!input) {
    return undefined;
  }
  try {
    return Buffer.from(input, "base64").toString("utf-8");
  } catch {
    return undefined;
  }
}

function isoDateDaysAgo(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

export async function getPromiseSummaryTool(
  input: SummaryInput,
  extra?: ToolExtra
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  try {
    const headers = extra?.requestInfo?.headers ?? {};
    const context = getContext(headers);
    const client = new FhirClient(context);
    const patientId = input.patientId ?? context.patientId;
    const lookbackDays = input.lookbackDays ?? 90;

    const allPromises: ClinicalPromise[] = [];
    let analyzedNotes = 0;

    if (input.notes && input.notes.length > 0) {
      // Use directly provided notes
      for (const note of input.notes) {
        if (!note.noteText?.trim()) continue;
        const noteDate = note.noteDate ?? new Date().toISOString().slice(0, 10);
        const extracted = await extractPromises(note.noteText, noteDate, patientId);
        allPromises.push(...extracted);
        analyzedNotes++;
      }
    } else {
      // Fall back to FHIR DocumentReference search
      const docs = await findDocumentReferences(client, patientId, undefined, isoDateDaysAgo(lookbackDays));
      for (const doc of docs) {
        const noteText =
          decodeBase64(doc.content?.[0]?.attachment?.data) ??
          doc.description ??
          doc.content?.[0]?.attachment?.title;
        if (!noteText) continue;

        const noteDate = doc.date?.slice(0, 10) ?? new Date().toISOString().slice(0, 10);
        const extracted = await extractPromises(noteText, noteDate, patientId);
        allPromises.push(
          ...extracted.map((promise) => ({
            ...promise,
            sourceDocumentId: doc.id ?? promise.sourceDocumentId,
          }))
        );
        analyzedNotes++;
      }
    }

    const statuses = await checkPromises(client, allPromises);
    const unkept = statuses.filter((status) => status.status === "unkept");
    const tasks = generateTasks(patientId, unkept);
    const communications = generateCommunicationRequests(patientId, unkept);

    const summary = {
      patientId,
      analyzedNotes,
      totalPromises: statuses.length,
      kept: statuses.filter((status) => status.status === "kept").length,
      unkept: unkept.length,
      pending: statuses.filter((status) => status.status === "pending").length,
      unkeptDetails: unkept,
      generatedTasks: tasks,
      generatedCommunications: communications,
      checkedAt: new Date().toISOString(),
    };

    return {
      content: [{ type: "text", text: JSON.stringify(summary, null, 2) }],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[get_promise_summary] Error:", message);
    return {
      content: [{ type: "text", text: `get_promise_summary failed: ${message}` }],
    };
  }
}
