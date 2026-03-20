import { GoogleGenAI } from "@google/genai";

function requireEnv(name: "GCP_PROJECT_ID" | "GCP_LOCATION" | "GEMINI_MODEL"): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export async function callGemini(systemPrompt: string, userPrompt: string): Promise<string> {
  const project = requireEnv("GCP_PROJECT_ID");
  const location = requireEnv("GCP_LOCATION");
  const model = requireEnv("GEMINI_MODEL");

  try {
    const ai = new GoogleGenAI({
      vertexai: true,
      project,
      location,
    });

    const response = await ai.models.generateContent({
      model,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
      },
      contents: userPrompt,
    });

    const text = response.text?.trim();

    if (!text) {
      throw new Error("Gemini returned an empty response.");
    }

    return text;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Gemini API call failed: ${message}`);
  }
}
