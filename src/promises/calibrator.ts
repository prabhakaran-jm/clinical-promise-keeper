import { callGemini } from "../llm/gemini.js";
import type { ClinicalPromise } from "./types.js";

const CALIBRATION_PROMPT = `You are a clinical NLP quality checker. Given a list of extracted clinical promises and the original note text, validate each extraction.

For each promise, assess:
1. Is the exact quote actually present in the note? (true/false)
2. Is the classification (lab/appointment/imaging_document) correct? (true/false)
3. Is the timeframe interpretation reasonable? (true/false)
4. Adjusted confidence score (0-1)

Return JSON array with one entry per promise:
[
  {
    "id": "promise-id",
    "quotePresent": true,
    "classCorrect": true,
    "timeframeReasonable": true,
    "adjustedConfidence": 0.92,
    "note": "optional correction note"
  }
]

Rules:
- If the quote is NOT found in the note, set adjustedConfidence to 0
- If the class seems wrong, reduce confidence by 0.3
- If timeframe interpretation seems off, reduce confidence by 0.2
- Be strict - false positives are worse than false negatives in clinical safety`;

export async function calibratePromises(
  promises: ClinicalPromise[],
  originalNote: string
): Promise<ClinicalPromise[]> {
  if (promises.length === 0) return [];

  try {
    const userPrompt = JSON.stringify({
      originalNote: originalNote.slice(0, 3000),
      promises: promises.map((p) => ({
        id: p.id,
        exactQuote: p.sourceText,
        class: p.class,
        description: p.description,
        relativeTerm: p.timeframe.relativeTerm,
        confidence: p.confidence,
      })),
    });

    const raw = await callGemini(CALIBRATION_PROMPT, userPrompt);
    const calibrations = JSON.parse(raw) as unknown;

    if (!Array.isArray(calibrations)) return promises;

    const calibrationMap = new Map(
      calibrations.map((c: any) => [c.id, c] as const)
    );

    return promises
      .map((promise) => {
        const cal = calibrationMap.get(promise.id);
        if (!cal) return promise;

        const adjustedConfidence =
          typeof cal.adjustedConfidence === "number"
            ? cal.adjustedConfidence
            : promise.confidence;

        return {
          ...promise,
          confidence: adjustedConfidence,
          confidenceLevel: adjustedConfidence >= 0.8 ? ("high" as const) : ("medium" as const),
        };
      })
      .filter((p) => p.confidence >= 0.3);
  } catch (error) {
    console.error("[Calibrator] Calibration failed, returning uncalibrated:", error);
    return promises;
  }
}
