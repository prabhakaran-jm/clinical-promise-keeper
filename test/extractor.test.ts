import { beforeEach, describe, expect, it, vi } from "vitest";
import { normalizeTimeframe } from "../src/promises/normalizer.js";
import { extractPromises } from "../src/promises/extractor.js";
import { sampleNotes } from "./fixtures/sample-notes.js";
import * as gemini from "../src/llm/gemini.js";

describe("normalizeTimeframe", () => {
  it("normalizes in X weeks with +/- 1 week buffer", () => {
    const result = normalizeTimeframe("in 3 weeks", "2026-03-01");
    expect(result).toEqual({
      earliest: "2026-03-15",
      latest: "2026-03-29",
    });
  });

  it("normalizes next visit to 2-6 weeks", () => {
    const result = normalizeTimeframe("next visit", "2026-03-01");
    expect(result).toEqual({
      earliest: "2026-03-15",
      latest: "2026-04-12",
    });
  });

  it("normalizes soon to 1-2 weeks", () => {
    const result = normalizeTimeframe("soon", "2026-03-01");
    expect(result).toEqual({
      earliest: "2026-03-08",
      latest: "2026-03-15",
    });
  });
});

describe("extractPromises", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("maps Gemini output to ClinicalPromise[]", async () => {
    vi.spyOn(gemini, "callGemini").mockResolvedValue(
      JSON.stringify([
        {
          exactQuote: "recheck A1c in 3 weeks",
          class: "lab",
          description: "Repeat A1c in three weeks",
          code: "4548-4",
          codeSystem: "http://loinc.org",
          displayName: "Hemoglobin A1c",
          relativeTerm: "in 3 weeks",
          confidence: 0.91,
        },
      ])
    );

    const promises = await extractPromises(sampleNotes.noteA.noteText, sampleNotes.noteA.noteDate, "pat-123");

    expect(promises).toHaveLength(1);
    expect(promises[0]).toMatchObject({
      patientId: "pat-123",
      class: "lab",
      description: "Repeat A1c in three weeks",
      expectedAction: {
        code: "4548-4",
        codeSystem: "http://loinc.org",
        displayName: "Hemoglobin A1c",
      },
      timeframe: {
        relativeTerm: "in 3 weeks",
        referenceDate: "2026-03-01",
      },
    });
    expect(promises[0].id).toBeTypeOf("string");
  });

  it("filters promises below confidence threshold", async () => {
    vi.spyOn(gemini, "callGemini").mockResolvedValue(
      JSON.stringify([
        {
          exactQuote: "repeat CBC next visit",
          class: "lab",
          description: "Repeat CBC at next visit",
          code: null,
          codeSystem: null,
          displayName: "CBC",
          relativeTerm: "next visit",
          confidence: 0.2,
        },
        {
          exactQuote: "return in 3 months",
          class: "appointment",
          description: "Follow up in 3 months",
          code: null,
          codeSystem: null,
          displayName: null,
          relativeTerm: "in 3 months",
          confidence: 0.72,
        },
      ])
    );

    const promises = await extractPromises(sampleNotes.noteA.noteText, sampleNotes.noteA.noteDate, "pat-123");
    expect(promises).toHaveLength(1);
    expect(promises[0].class).toBe("appointment");
  });

  it("handles markdown wrapped JSON", async () => {
    vi.spyOn(gemini, "callGemini").mockResolvedValue(`\n\`\`\`json\n[]\n\`\`\`\n`);
    const promises = await extractPromises(sampleNotes.noteC.noteText, sampleNotes.noteC.noteDate, "pat-999");
    expect(promises).toEqual([]);
  });
});
