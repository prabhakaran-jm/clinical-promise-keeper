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

  it("normalizes spelled-out numbers like digit form (in three weeks ≈ in 3 weeks)", () => {
    const digits = normalizeTimeframe("in 3 weeks", "2026-03-01");
    const words = normalizeTimeframe("in three weeks", "2026-03-01");
    expect(words).toEqual(digits);
    expect(words).toEqual({
      earliest: "2026-03-15",
      latest: "2026-03-29",
    });
  });

  it('normalizes "within the next 4 weeks" with a tighter window than "in 4 weeks"', () => {
    const result = normalizeTimeframe("within the next 4 weeks", "2026-03-01");
    expect(result).toEqual({
      earliest: "2026-03-24",
      latest: "2026-04-03",
    });
  });

  it('normalizes "by March" from reference through end of March', () => {
    const result = normalizeTimeframe("by March", "2026-02-01");
    expect(result).toEqual({
      earliest: "2026-02-01",
      latest: "2026-03-31",
    });
  });

  it("normalizes next week to 7-14 days", () => {
    const result = normalizeTimeframe("next week", "2026-03-01");
    expect(result).toEqual({
      earliest: "2026-03-08",
      latest: "2026-03-15",
    });
  });

  it("normalizes quarterly to ~2.5-3.5 months in days", () => {
    const result = normalizeTimeframe("quarterly", "2026-03-01");
    expect(result).toEqual({
      earliest: "2026-05-15",
      latest: "2026-06-14",
    });
  });

  it('normalizes "as needed" to a wide one-year window', () => {
    const result = normalizeTimeframe("as needed", "2026-03-01");
    expect(result).toEqual({
      earliest: "2026-03-01",
      latest: "2027-03-01",
    });
  });

  it("returns null for empty relative term", () => {
    expect(normalizeTimeframe("", "2026-03-01")).toBeNull();
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

  it("calibration adjusts confidence down for low-quality extraction", async () => {
    const spy = vi
      .spyOn(gemini, "callGemini")
      .mockResolvedValueOnce(
        JSON.stringify([
          {
            exactQuote: "return in 3 months",
            class: "appointment",
            description: "Follow up in 3 months",
            code: null,
            codeSystem: null,
            displayName: null,
            relativeTerm: "in 3 months",
            confidence: 0.9,
          },
        ])
      )
      .mockImplementationOnce(async (_system, userPrompt) => {
        const payload = JSON.parse(userPrompt) as { promises: Array<{ id: string }> };
        return JSON.stringify([
          {
            id: payload.promises[0].id,
            quotePresent: true,
            classCorrect: false,
            timeframeReasonable: true,
            adjustedConfidence: 0.6,
            note: "Class may be overstated.",
          },
        ]);
      });

    const promises = await extractPromises(sampleNotes.noteA.noteText, sampleNotes.noteA.noteDate, "pat-123");
    expect(promises).toHaveLength(1);
    expect(promises[0].confidence).toBe(0.6);
    expect(promises[0].confidenceLevel).toBe("medium");
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("removes promise when calibration sets confidence to zero (quote not found)", async () => {
    vi.spyOn(gemini, "callGemini")
      .mockResolvedValueOnce(
        JSON.stringify([
          {
            exactQuote: "repeat CBC next visit",
            class: "lab",
            description: "Repeat CBC at next visit",
            code: null,
            codeSystem: null,
            displayName: "CBC",
            relativeTerm: "next visit",
            confidence: 0.72,
          },
        ])
      )
      .mockImplementationOnce(async (_system, userPrompt) => {
        const payload = JSON.parse(userPrompt) as { promises: Array<{ id: string }> };
        return JSON.stringify([
          {
            id: payload.promises[0].id,
            quotePresent: false,
            classCorrect: true,
            timeframeReasonable: true,
            adjustedConfidence: 0,
            note: "Quote not present in original note.",
          },
        ]);
      });

    const promises = await extractPromises(sampleNotes.noteA.noteText, sampleNotes.noteA.noteDate, "pat-123");
    expect(promises).toEqual([]);
  });

  it("falls back to original promises when calibration fails", async () => {
    vi.spyOn(gemini, "callGemini")
      .mockResolvedValueOnce(
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
      )
      .mockRejectedValueOnce(new Error("Calibration unavailable"));

    const promises = await extractPromises(sampleNotes.noteA.noteText, sampleNotes.noteA.noteDate, "pat-123");
    expect(promises).toHaveLength(1);
    expect(promises[0].confidence).toBe(0.91);
    expect(promises[0].confidenceLevel).toBe("high");
  });
});
