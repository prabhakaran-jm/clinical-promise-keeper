import { callGemini } from "./gemini.js";
import type { ClinicalPromise } from "../promises/types.js";

const VERIFY_SYSTEM_PROMPT = `You are a clinical verification assistant. Given a clinical promise and the FHIR data found (or not found), provide a brief clinical interpretation.

For each promise verification result, generate:
1. A 1-2 sentence clinical explanation of what was found or missing
2. A clinical significance assessment: "high" (patient safety risk), "medium" (quality gap), or "low" (administrative)
3. A specific recommended action

Return JSON:
{
  "explanation": "string",
  "clinicalSignificance": "high" | "medium" | "low",
  "recommendedAction": "string"
}

Rules:
- Be concise and clinically precise
- "high" significance: missed cancer screening, overdue cardiac follow-up, missing critical lab before medication adjustment
- "medium" significance: routine lab recheck slightly overdue, pending referral
- "low" significance: administrative tasks, record requests
- Return valid JSON only`;

export interface VerificationInsight {
  explanation: string;
  clinicalSignificance: "high" | "medium" | "low";
  recommendedAction: string;
}

export async function generateVerificationInsight(
  promise: ClinicalPromise,
  status: string,
  evidence: unknown,
  reason?: string
): Promise<VerificationInsight> {
  const userPrompt = JSON.stringify({
    promise: {
      description: promise.description,
      class: promise.class,
      sourceText: promise.sourceText,
      timeframe: promise.timeframe,
      expectedAction: promise.expectedAction,
    },
    verificationResult: {
      status,
      evidence: evidence ?? null,
      reason: reason ?? null,
      currentDate: new Date().toISOString().split("T")[0],
    },
  });

  try {
    const raw = await callGemini(VERIFY_SYSTEM_PROMPT, userPrompt);
    const parsed = JSON.parse(raw);
    return {
      explanation: parsed.explanation ?? "No explanation available",
      clinicalSignificance: parsed.clinicalSignificance ?? "medium",
      recommendedAction: parsed.recommendedAction ?? "Review with clinical team",
    };
  } catch (error) {
    console.error("[Verifier] Insight generation failed:", error);
    return {
      explanation: reason ?? `Promise ${status}: ${promise.description}`,
      clinicalSignificance: inferSignificance(promise),
      recommendedAction: inferAction(promise, status),
    };
  }
}

function inferSignificance(promise: ClinicalPromise): "high" | "medium" | "low" {
  const desc = promise.description.toLowerCase();
  if (
    desc.includes("ct") ||
    desc.includes("cancer") ||
    desc.includes("nodule") ||
    desc.includes("cardiac") ||
    desc.includes("chest") ||
    desc.includes("biopsy")
  ) {
    return "high";
  }
  if (promise.class === "imaging_document" && (desc.includes("record") || desc.includes("obtain"))) {
    return "low";
  }
  return "medium";
}

function inferAction(promise: ClinicalPromise, status: string): string {
  if (status === "kept") return "No action needed";
  if (status === "pending") return "Monitor - still within expected window";
  if (promise.class === "lab") return "Place lab order or verify with ordering provider";
  if (promise.class === "appointment") return "Schedule follow-up appointment";
  return "Review and take appropriate action";
}
