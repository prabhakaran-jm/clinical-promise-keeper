import { beforeEach, describe, expect, it, vi } from "vitest";
import * as gemini from "../src/llm/gemini.js";
import { extractPromisesTool } from "../src/tools/extract-promises.js";
import { checkPromisesTool } from "../src/tools/check-promises.js";
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

function mockGeminiExtraction(items: unknown[]) {
  vi.spyOn(gemini, "callGemini").mockResolvedValue(JSON.stringify(items));
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
    const parsed = JSON.parse(result.content[0].text);
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

    const parsed = JSON.parse(result.content[0].text);
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

    const parsed = JSON.parse(result.content[0].text);
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

    const parsed = JSON.parse(result.content[0].text);
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

    const parsed = JSON.parse(result.content[0].text);
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
    mockGeminiExtraction([
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
    ]);

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

    const summary = JSON.parse(result.content[0].text);
    expect(summary.patientId).toBe("test-patient-123");
    expect(summary.analyzedNotes).toBe(1);
    expect(summary.totalPromises).toBe(1);
    expect(summary.unkept).toBeGreaterThanOrEqual(0);
    expect(summary).toHaveProperty("generatedTasks");
    expect(summary).toHaveProperty("generatedCommunications");
    expect(summary).toHaveProperty("checkedAt");

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
    // Mock fetch for FHIR DocumentReference search returns empty
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ resourceType: "Bundle", total: 0 }),
      })
    );

    const result = await getPromiseSummaryTool({ notes: [] }, EXTRA);

    const summary = JSON.parse(result.content[0].text);
    expect(summary.analyzedNotes).toBe(0);
    expect(summary.totalPromises).toBe(0);

    vi.unstubAllGlobals();
  });
});
