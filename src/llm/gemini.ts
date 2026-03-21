import { GoogleGenAI } from "@google/genai";

const PROJECT_ID = process.env.GCP_PROJECT_ID ?? "";
const LOCATION = process.env.GCP_LOCATION ?? "global";
const MODEL = process.env.GEMINI_MODEL ?? "gemini-3.1-flash-lite-preview";

let ai: GoogleGenAI | undefined;

function getClient(): GoogleGenAI {
  if (!PROJECT_ID.trim()) {
    throw new Error("Missing required environment variable: GCP_PROJECT_ID");
  }
  if (!ai) {
    ai = new GoogleGenAI({
      vertexai: true,
      project: PROJECT_ID,
      location: LOCATION,
    });
  }
  return ai;
}

const MAX_RETRIES = 2;
const TIMEOUT_MS = 30_000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} after ${ms / 1000}s`)), ms)
    ),
  ]);
}

export type CallGeminiOptions = {
  /** Default "application/json" for structured extraction; use "text/plain" for markdown narratives. */
  responseMimeType?: string;
};

export async function callGemini(
  systemPrompt: string,
  userPrompt: string,
  options?: CallGeminiOptions
): Promise<string> {
  const responseMimeType = options?.responseMimeType ?? "application/json";
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const client = getClient();
      const response = await withTimeout(
        client.models.generateContent({
          model: MODEL,
          contents: userPrompt,
          config: {
            systemInstruction: systemPrompt,
            responseMimeType,
          },
        }),
        TIMEOUT_MS,
        "Gemini timeout"
      );

      const text = response?.text?.trim();
      if (!text) {
        throw new Error("Gemini returned empty response");
      }
      return text;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`[Gemini] Attempt ${attempt + 1} failed:`, lastError.message);

      // Don't retry on client errors (4xx) — only on server/network errors
      if (lastError.message.includes("400") || lastError.message.includes("403")) {
        break;
      }

      if (attempt < MAX_RETRIES) {
        const delay = Math.min(1000 * 2 ** attempt, 5000);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }

  throw new Error(`Gemini API call failed after ${MAX_RETRIES + 1} attempts: ${lastError?.message}`);
}
