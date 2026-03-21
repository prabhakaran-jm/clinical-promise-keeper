import type { ClinicalPromise } from "./types.js";
import { v4 as uuidv4 } from "uuid";
import { callGemini } from "../llm/gemini.js";
import { buildFewShotPrompt } from "../llm/extraction-examples.js";
import { defaultTimeframeFallback, normalizeTimeframe } from "./normalizer.js";

const BASE_SYSTEM_PROMPT = `You are a clinical NLP system. Extract implicit and explicit clinical commitments from the following physician note.

A "clinical promise" is any statement that implies a future action should be taken for the patient, including:

Lab orders or re-checks ("recheck potassium in 2 weeks", "repeat CBC next visit")
Follow-up appointments ("return in 3 months", "refer to cardiology")
Imaging or document requests ("repeat CT in 6 months", "obtain outside records from St. Mary's")
For each promise found, extract:

exactQuote: The exact quote from the note
class: "lab" | "appointment" | "imaging_document"
description: Human-readable description of expected action
code: LOINC/CPT code if identifiable (null if not)
codeSystem: "http://loinc.org" or "http://www.ama-assn.org/go/cpt" (null if no code)
displayName: Test/procedure name (e.g., "Hemoglobin A1c")
relativeTerm: Timeframe as written (e.g., "in 3 weeks")
confidence: 0-1 confidence score
Rules:

Only extract actionable commitments, not observations or history
"Continue current medications" is NOT a promise
"Check labs at next visit" IS a promise
Return empty array if no promises found
Return valid JSON array only, no markdown or explanation`;

function buildSystemPrompt(): string {
  return `${BASE_SYSTEM_PROMPT}

IMPORTANT: Before extracting, briefly reason about each candidate sentence. Ask yourself:
- Is this a NEW future action, or maintaining the status quo?
- Does this imply an order, referral, or scheduling action?
- Is there a clear or implied timeframe?

Here are examples of correct extraction with reasoning:

${buildFewShotPrompt()}

Now analyze the following note. Return ONLY the JSON array of promises (no reasoning text in output).`;
}

type LlmPromise = {
  exactQuote?: unknown;
  class?: unknown;
  description?: unknown;
  code?: unknown;
  codeSystem?: unknown;
  displayName?: unknown;
  relativeTerm?: unknown;
  confidence?: unknown;
};

function cleanJsonResponse(raw: string): string {
  let cleaned = raw.trim();

  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenceMatch?.[1]) {
    cleaned = fenceMatch[1].trim();
  }

  const arrayStart = cleaned.indexOf("[");
  const arrayEnd = cleaned.lastIndexOf("]");
  if (arrayStart !== -1 && arrayEnd !== -1 && arrayEnd > arrayStart) {
    cleaned = cleaned.slice(arrayStart, arrayEnd + 1);
  }

  return cleaned.trim();
}

function parsePromiseArray(raw: string): LlmPromise[] {
  const cleaned = cleanJsonResponse(raw);
  try {
    const parsed = JSON.parse(cleaned) as unknown;
    if (!Array.isArray(parsed)) {
      throw new Error("Gemini output is not a JSON array.");
    }
    return parsed as LlmPromise[];
  } catch {
    // Retry with the first plausible JSON array segment in case extra prose remained.
    const fallbackMatch = cleaned.match(/\[[\s\S]*\]/);
    if (!fallbackMatch) {
      throw new Error("Could not parse Gemini response as JSON array.");
    }
    const parsed = JSON.parse(fallbackMatch[0]) as unknown;
    if (!Array.isArray(parsed)) {
      throw new Error("Could not parse Gemini response as JSON array.");
    }
    return parsed as LlmPromise[];
  }
}

function isPromiseClass(value: unknown): value is ClinicalPromise["class"] {
  return value === "lab" || value === "appointment" || value === "imaging_document";
}

export async function extractPromises(
  noteText: string,
  noteDate: string,
  patientId: string
): Promise<ClinicalPromise[]> {
  const userPrompt = `Note date: ${noteDate}\nPatient ID: ${patientId}\n\nClinical Note:\n${noteText}`;
  const rawResponse = await callGemini(buildSystemPrompt(), userPrompt);
  const llmPromises = parsePromiseArray(rawResponse);

  const results: ClinicalPromise[] = [];

  for (const item of llmPromises) {
    const confidence = typeof item.confidence === "number" ? item.confidence : 0;
    if (confidence < 0.3) {
      continue;
    }

    if (!isPromiseClass(item.class)) {
      continue;
    }
    const promiseClass = item.class;

    const sourceText = typeof item.exactQuote === "string" ? item.exactQuote.trim() : "";
    const description = typeof item.description === "string" ? item.description.trim() : "";
    const relativeTerm = typeof item.relativeTerm === "string" ? item.relativeTerm.trim() : "next visit";

    if (!sourceText || !description) {
      continue;
    }

    const timeframe = normalizeTimeframe(relativeTerm, noteDate) ?? defaultTimeframeFallback(noteDate);

    results.push({
      id: uuidv4(),
      sourceDocumentId: "provided-note",
      sourceText,
      patientId,
      class: promiseClass,
      description,
      expectedAction: {
        type: promiseClass,
        code: typeof item.code === "string" ? item.code : undefined,
        codeSystem: typeof item.codeSystem === "string" ? item.codeSystem : undefined,
        displayName: typeof item.displayName === "string" ? item.displayName : undefined,
      },
      timeframe: {
        relativeTerm,
        earliest: timeframe.earliest,
        latest: timeframe.latest,
        referenceDate: noteDate,
      },
      confidence,
      confidenceLevel: confidence >= 0.8 ? "high" : "medium",
    });
  }

  return results;
}
