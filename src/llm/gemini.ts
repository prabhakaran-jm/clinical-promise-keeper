import { VertexAI } from "@google-cloud/vertexai";

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
    const vertexAI = new VertexAI({ project, location });
    const generativeModel = vertexAI.getGenerativeModel({
      model,
      systemInstruction: {
        role: "system",
        parts: [{ text: systemPrompt }],
      },
      generationConfig: {
        responseMimeType: "application/json",
      },
    });

    const response = await generativeModel.generateContent({
      contents: [
        {
          role: "user",
          parts: [{ text: userPrompt }],
        },
      ],
    });

    const text = response.response.candidates?.[0]?.content?.parts
      ?.map((part) => ("text" in part ? part.text ?? "" : ""))
      .join("")
      .trim();

    if (!text) {
      throw new Error("Gemini returned an empty response.");
    }

    return text;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Gemini API call failed: ${message}`);
  }
}
