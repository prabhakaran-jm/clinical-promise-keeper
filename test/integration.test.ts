import { beforeEach, describe, expect, it, vi } from "vitest";
import * as gemini from "../src/llm/gemini.js";
import { extractPromisesTool } from "../src/tools/extract-promises.js";
import { generateTasksTool } from "../src/tools/generate-tasks.js";
import { getPromiseSummaryTool } from "../src/tools/get-promise-summary.js";
import { getContext, ForbiddenError } from "../src/sharp/context.js";
import type { ClinicalPromise, PromiseStatus } from "../src/promises/types.js";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const SHARP_HEADERS = {
  "x-fhir-server-url": "https://hapi.fhir.org/baseR4",
  "x-fhir-access-token": "test-token",
  "x-patient-id": "test-patient-123",
};

const EXTRA = { requestInfo: { headers: SHARP_HEADERS } };

/** Strip clinical/task disclaimer suffix before parsing tool JSON. */
function parseToolJson(text: string): unknown {
  const sep = "\n\n---\n";
  const idx = text.indexOf(sep);
  const jsonPart = idx === -1 ? text : text.slice(0, idx);
  return JSON.parse(jsonPart);
}

function mockGeminiExtraction(items: unknown[]) {
  vi.spyOn(gemini, "callGemini").mockResolvedValue(JSON.stringify(items));
}

/** Extraction returns JSON; second pass (clinical summary) returns markdown when `responseMimeType` is text/plain. */
function mockGeminiExtractionAndSummary(extractionItems: unknown[], narrativeMarkdown: string) {
  vi.spyOn(gemini, "callGemini").mockImplementation(
    async (_systemPrompt: string, _userPrompt: string, opts?: gemini.CallGeminiOptions) => {
      if (opts?.responseMimeType === "text/plain") {
        return narrativeMarkdown;
      }
      return JSON.stringify(extractionItems);
    }
  );
}

function buildPromise(overrides: Partial<ClinicalPromise> = {}): ClinicalPromise {
  return {
    id: "test-id-1",
    sourceDocumentId: "doc-1",
    sourceText: "recheck A1c in 3 weeks",
    patientId: "test-patient-123",
    class: "lab",
    description: "Repeat A1c in three weeks",
    expectedAction: {
      type: "lab",
      code: "4548-4",
      codeSystem: "http://loinc.org",
      displayName: "Hemoglobin A1c",
    },
    timeframe: {
      relativeTerm: "in 3 weeks",
      earliest: "2026-03-15",
      latest: "2026-03-29",
      referenceDate: "2026-03-01",
    },
    confidence: 0.91,
    confidenceLevel: "high",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// SHARP context tests
// ---------------------------------------------------------------------------

describe("SHARP context extraction", () => {
  it("returns context when all headers present", () => {
    const ctx = getContext(SHARP_HEADERS);
    expect(ctx).toEqual({
      fhirServerUrl: "https://hapi.fhir.org/baseR4",
      fhirAccessToken: "test-token",
      patientId: "test-patient-123",
    });
  });

  it("throws ForbiddenError when headers missing", () => {
    expect(() => getContext({})).toThrow(ForbiddenError);
  });

  it("throws ForbiddenError for partial headers", () => {
    expect(() => getContext({ "x-fhir-server-url": "https://example.com" })).toThrow(ForbiddenError);
  });
});

// ---------------------------------------------------------------------------
// extract_promises tool integration
// ---------------------------------------------------------------------------

describe("extract_promises tool", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("returns extracted promises via tool interface", async () => {
    mockGeminiExtraction([
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
    ]);

    const result = await extractPromisesTool(
      { noteText: "Plan: recheck A1c in 3 weeks", noteDate: "2026-03-01" },
      EXTRA
    );

    expect(result.content).toHaveLength(1);
    expect(result.content[0].text).toContain("AI-Generated Analysis");
    const parsed = parseToolJson(result.content[0].text) as ClinicalPromise[];
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].class).toBe("lab");
    expect(parsed[0].confidenceLevel).toBe("high");
  });

  it("returns error text when SHARP headers missing", async () => {
    const result = await extractPromisesTool(
      { noteText: "some note", noteDate: "2026-03-01" },
      { requestInfo: { headers: {} } }
    );

    expect(result.content[0].text).toContain("Missing required SHARP context headers");
  });

  it("sets confidenceLevel medium for 0.3-0.8 range", async () => {
    mockGeminiExtraction([
      {
        exactQuote: "return in 3 months",
        class: "appointment",
        description: "Follow up in 3 months",
        code: null,
        codeSystem: null,
        displayName: null,
        relativeTerm: "in 3 months",
        confidence: 0.55,
      },
    ]);

    const result = await extractPromisesTool(
      { noteText: "Plan: return in 3 months", noteDate: "2026-03-01" },
      EXTRA
    );

    const parsed = parseToolJson(result.content[0].text) as Array<{ confidenceLevel?: string }>;
    expect(parsed[0].confidenceLevel).toBe("medium");
  });
});

// ---------------------------------------------------------------------------
// generate_tasks tool integration
// ---------------------------------------------------------------------------

describe("generate_tasks tool", () => {
  it("generates FHIR Tasks from unkept promises", async () => {
    const unkeptPromise: PromiseStatus = {
      promise: buildPromise(),
      status: "unkept",
      reason: "No lab order found",
      checkedAt: "2026-03-20T00:00:00.000Z",
    };

    const result = await generateTasksTool(
      { patientId: "test-patient-123", unkeptPromises: [unkeptPromise], writeback: false },
      EXTRA
    );

    expect(result.content[0].text).toContain("Draft Tasks");
    const parsed = parseToolJson(result.content[0].text) as Array<{
      resourceType: string;
      status: string;
      intent: string;
      for: { reference: string };
    }>;
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].resourceType).toBe("Task");
    expect(parsed[0].status).toBe("draft");
    expect(parsed[0].intent).toBe("proposal");
    expect(parsed[0].for.reference).toBe("Patient/test-patient-123");
  });

  it("sets priority urgent when past due", async () => {
    const pastDuePromise: PromiseStatus = {
      promise: buildPromise({
        timeframe: {
          relativeTerm: "in 1 week",
          earliest: "2025-01-01",
          latest: "2025-01-15",
          referenceDate: "2025-01-01",
        },
      }),
      status: "unkept",
      reason: "Past due",
      checkedAt: "2026-03-20T00:00:00.000Z",
    };

    const result = await generateTasksTool(
      { patientId: "test-patient-123", unkeptPromises: [pastDuePromise], writeback: false },
      EXTRA
    );

    const parsed = parseToolJson(result.content[0].text) as Array<{ priority: string }>;
    expect(parsed[0].priority).toBe("urgent");
  });

  it("handles simplified task input from agent", async () => {
    const simplifiedInput = [
      {
        title: "Order A1c",
        description: "Recheck hemoglobin A1c",
        priority: "urgent",
        status: "draft",
        dueDate: "2026-04-01",
      },
    ];

    const result = await generateTasksTool(
      { patientId: "test-patient-123", unkeptPromises: simplifiedInput as unknown as PromiseStatus[] },
      EXTRA
    );

    const parsed = parseToolJson(result.content[0].text) as Array<{
      resourceType: string;
      for: { reference: string };
    }>;
    expect(parsed).toHaveLength(1);
    expect(parsed[0].resourceType).toBe("Task");
    expect(parsed[0].for.reference).toBe("Patient/test-patient-123");
  });
});

// ---------------------------------------------------------------------------
// get_promise_summary tool integration
// ---------------------------------------------------------------------------

describe("get_promise_summary tool", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("runs end-to-end with provided notes", async () => {
    mockGeminiExtractionAndSummary(
      [
        {
          exactQuote: "recheck potassium in 2 weeks",
          class: "lab",
          description: "Repeat potassium level",
          code: "2823-3",
          codeSystem: "http://loinc.org",
          displayName: "Potassium",
          relativeTerm: "in 2 weeks",
          confidence: 0.88,
        },
      ],
      "## Follow-Up Gap Analysis\n\n**Patient:** test-patient-123\n\n### Summary\nAI-generated narrative for judges."
    );

    // Mock fetch for FHIR queries (ServiceRequest search returns empty)
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ resourceType: "Bundle", total: 0, entry: [] }),
      })
    );

    const result = await getPromiseSummaryTool(
      {
        notes: [{ noteText: "Plan: recheck potassium in 2 weeks", noteDate: "2026-03-01" }],
      },
      EXTRA
    );

    expect(result.content[0].text).toContain("AI-Generated Analysis");
    const output = parseToolJson(result.content[0].text) as {
      narrative: string | null;
      structuredData: Record<string, unknown>;
    };
    expect(output.narrative).toContain("Follow-Up Gap Analysis");
    expect(output.structuredData.patientId).toBe("test-patient-123");
    expect(output.structuredData.analyzedNotes).toBe(1);
    expect(output.structuredData.totalPromises).toBe(1);
    expect(output.structuredData.unkept).toBeGreaterThanOrEqual(0);
    expect(output.structuredData).toHaveProperty("generatedTasks");
    expect(output.structuredData).toHaveProperty("generatedCommunications");
    expect(output.structuredData).toHaveProperty("checkedAt");

    vi.unstubAllGlobals();
  });

  it("returns error when SHARP headers missing", async () => {
    const result = await getPromiseSummaryTool(
      { notes: [{ noteText: "some note", noteDate: "2026-03-01" }] },
      { requestInfo: { headers: {} } }
    );

    expect(result.content[0].text).toContain("get_promise_summary failed");
  });

  it("handles empty notes array", async () => {
    mockGeminiExtractionAndSummary(
      [],
      "## Follow-Up Gap Analysis\n\nNo clinical promises found in the analyzed period."
    );
    // Mock fetch for FHIR DocumentReference search returns empty
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ resourceType: "Bundle", total: 0 }),
      })
    );

    const result = await getPromiseSummaryTool({ notes: [] }, EXTRA);

    const output = parseToolJson(result.content[0].text) as {
      narrative: string | null;
      structuredData: Record<string, unknown>;
    };
    expect(output.structuredData.analyzedNotes).toBe(0);
    expect(output.structuredData.totalPromises).toBe(0);
    expect(output.narrative).toContain("Follow-Up Gap Analysis");

    vi.unstubAllGlobals();
  });

  it("returns narrative and structuredData when summary LLM succeeds", async () => {
    mockGeminiExtractionAndSummary(
      [
        {
          exactQuote: "A1c in 3 weeks",
          class: "lab",
          description: "Repeat A1c",
          code: "4548-4",
          codeSystem: "http://loinc.org",
          displayName: "A1c",
          relativeTerm: "in 3 weeks",
          confidence: 0.9,
        },
      ],
      "## Follow-Up Gap Analysis\n\n**Patient:** test-patient-123\n\n### Summary\nOne gap identified."
    );
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ resourceType: "Bundle", total: 0, entry: [] }),
      })
    );

    const result = await getPromiseSummaryTool(
      { notes: [{ noteText: "Recheck A1c in 3 weeks", noteDate: "2026-03-01" }] },
      EXTRA
    );
    const output = parseToolJson(result.content[0].text) as {
      narrative: string | null;
      structuredData: { patientId?: string; totalPromises?: number };
    };
    expect(output.narrative).toBeTruthy();
    expect(output.narrative).toContain("Follow-Up Gap Analysis");
    expect(output.structuredData.patientId).toBe("test-patient-123");
    expect(output.structuredData.totalPromises).toBe(1);
    vi.unstubAllGlobals();
  });

  it("uses fallback markdown when narrative generation fails", async () => {
    vi.spyOn(gemini, "callGemini").mockImplementation(
      async (_systemPrompt: string, _userPrompt: string, opts?: gemini.CallGeminiOptions) => {
        if (opts?.responseMimeType === "text/plain") {
          throw new Error("Gemini summary unavailable");
        }
        return JSON.stringify([
          {
            exactQuote: "test",
            class: "lab",
            description: "Lab",
            code: "123",
            codeSystem: "http://loinc.org",
            displayName: "Test",
            relativeTerm: "in 1 week",
            confidence: 0.9,
          },
        ]);
      }
    );

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ resourceType: "Bundle", total: 0, entry: [] }),
      })
    );

    const result = await getPromiseSummaryTool(
      { notes: [{ noteText: "Do lab in 1 week", noteDate: "2026-03-01" }] },
      EXTRA
    );
    const output = parseToolJson(result.content[0].text) as {
      narrative: string | null;
      structuredData: Record<string, unknown>;
    };
    expect(output.narrative).toContain("narrative generation unavailable");
    expect(output.narrative).toContain("```json");
    expect(output.structuredData.totalPromises).toBe(1);
    vi.unstubAllGlobals();
  });

  it("skips narrative LLM when includeNarrative is false", async () => {
    const spy = vi.spyOn(gemini, "callGemini").mockResolvedValue(
      JSON.stringify([
        {
          exactQuote: "x",
          class: "lab",
          description: "d",
          code: "1",
          codeSystem: "http://loinc.org",
          displayName: "T",
          relativeTerm: "in 1 week",
          confidence: 0.9,
        },
      ])
    );
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ resourceType: "Bundle", total: 0, entry: [] }),
      })
    );

    const result = await getPromiseSummaryTool(
      {
        notes: [{ noteText: "Note", noteDate: "2026-03-01" }],
        includeNarrative: false,
      },
      EXTRA
    );
    const output = parseToolJson(result.content[0].text) as {
      narrative: string | null;
      structuredData: { patientId?: string };
    };
    expect(output.narrative).toBeNull();
    expect(output.structuredData.patientId).toBe("test-patient-123");
    // Extraction + calibration + verifier insight (narrative disabled).
    expect(spy).toHaveBeenCalledTimes(3);
    vi.unstubAllGlobals();
  });
});
