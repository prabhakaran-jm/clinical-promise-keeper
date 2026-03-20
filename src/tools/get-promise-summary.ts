import { Buffer } from "node:buffer";
import { FhirClient } from "../fhir/client.js";
import { findDocumentReferences } from "../fhir/queries.js";
import { extractPromises } from "../promises/extractor.js";
import { checkPromises } from "../promises/checker.js";
import { generateTasks } from "../tasks/generator.js";
import { getContext } from "../sharp/context.js";
import type { ClinicalPromise } from "../promises/types.js";

type SummaryInput = {
  patientId?: string;
  lookbackDays?: number;
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

    const docs = await findDocumentReferences(client, patientId, undefined, isoDateDaysAgo(lookbackDays));
    const allPromises: ClinicalPromise[] = [];

    for (const doc of docs) {
      const noteText =
        decodeBase64(doc.content?.[0]?.attachment?.data) ??
        doc.description ??
        doc.content?.[0]?.attachment?.title;
      if (!noteText) {
        continue;
      }

      const noteDate = doc.date?.slice(0, 10) ?? new Date().toISOString().slice(0, 10);
      const extracted = await extractPromises(noteText, noteDate, patientId);
      allPromises.push(
        ...extracted.map((promise) => ({
          ...promise,
          sourceDocumentId: doc.id ?? promise.sourceDocumentId,
        }))
      );
    }

    const statuses = await checkPromises(client, allPromises);
    const unkept = statuses.filter((status) => status.status === "unkept");
    const tasks = generateTasks(patientId, unkept);

    const summary = {
      patientId,
      analyzedNotes: docs.length,
      totalPromises: statuses.length,
      kept: statuses.filter((status) => status.status === "kept").length,
      unkept: unkept.length,
      pending: statuses.filter((status) => status.status === "pending").length,
      unkeptDetails: unkept,
      generatedTasks: tasks,
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
