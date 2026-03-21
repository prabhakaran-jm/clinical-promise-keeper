import { describe, expect, it, vi } from "vitest";
import { FhirClient } from "../src/fhir/client.js";
import { checkPromises } from "../src/promises/checker.js";
import { generateTasks } from "../src/tasks/generator.js";
import type { ClinicalPromise, PromiseStatus } from "../src/promises/types.js";
import { callGemini } from "../src/llm/gemini.js";

vi.mock("../src/llm/gemini.js", () => ({
  callGemini: vi.fn(),
}));

type SearchResponse = Record<string, unknown>;

class MockFhirClient {
  constructor(private readonly responder: (resourceType: string) => SearchResponse) {}

  async search<T extends Record<string, unknown>>(resourceType: string): Promise<T> {
    return this.responder(resourceType) as T;
  }

  async searchWithFallback<T extends Record<string, unknown>>(
    resourceType: string,
    _params?: Record<string, unknown>
  ): Promise<T> {
    return this.search<T>(resourceType);
  }
}

function makePromise(overrides: Partial<ClinicalPromise> = {}): ClinicalPromise {
  return {
    id: "p-1",
    sourceDocumentId: "doc-1",
    sourceText: "recheck A1c in 3 weeks",
    patientId: "pat-1",
    class: "lab",
    description: "Repeat A1c",
    expectedAction: {
      type: "lab_order",
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
    confidence: 0.9,
    ...overrides,
  };
}

describe("checkPromises", () => {
  it("attaches insight for unkept promises", async () => {
    vi.mocked(callGemini).mockResolvedValue(
      JSON.stringify({
        explanation: "No A1c result was found in the expected window despite the follow-up promise.",
        clinicalSignificance: "medium",
        recommendedAction: "Contact the patient and place or confirm the repeat A1c order.",
      })
    );

    const pastDuePromise = makePromise({
      timeframe: {
        relativeTerm: "in 3 weeks",
        earliest: "2024-01-01",
        latest: "2024-01-15",
        referenceDate: "2023-12-20",
      },
    });
    const client = new MockFhirClient(() => ({ resourceType: "Bundle", entry: [] }));

    const statuses = await checkPromises(client as never, [pastDuePromise]);
    expect(statuses[0].status).toBe("unkept");
    expect(statuses[0].insight).toMatchObject({
      clinicalSignificance: "medium",
    });
    expect(callGemini).toHaveBeenCalledTimes(1);
    vi.restoreAllMocks();
  });

  it("returns kept when matching Observation exists", async () => {
    vi.mocked(callGemini).mockClear();

    const client = new MockFhirClient((resourceType) => {
      if (resourceType === "ServiceRequest") {
        return { resourceType: "Bundle", entry: [{ resource: { resourceType: "ServiceRequest", id: "sr-1" } }] };
      }
      if (resourceType === "Observation") {
        return {
          resourceType: "Bundle",
          entry: [{ resource: { resourceType: "Observation", id: "obs-1", effectiveDateTime: "2026-03-20" } }],
        };
      }
      return { resourceType: "Bundle", entry: [] };
    });

    const statuses = await checkPromises(client as never, [makePromise()]);
    expect(statuses[0].status).toBe("kept");
    expect(statuses[0].evidence?.resourceType).toBe("Observation");
    expect(callGemini).not.toHaveBeenCalled();
    expect(statuses[0].insight).toBeUndefined();
    vi.restoreAllMocks();
  });

  it("returns unkept when no matching resources are found", async () => {
    vi.mocked(callGemini).mockResolvedValue(
      JSON.stringify({
        explanation: "No relevant evidence was found.",
        clinicalSignificance: "medium",
        recommendedAction: "Review with clinician.",
      })
    );

    const pastDuePromise = makePromise({
      timeframe: {
        relativeTerm: "in 3 weeks",
        earliest: "2024-01-01",
        latest: "2024-01-15",
        referenceDate: "2023-12-20",
      },
    });
    const client = new MockFhirClient(() => ({ resourceType: "Bundle", entry: [] }));

    const statuses = await checkPromises(client as never, [pastDuePromise]);
    expect(statuses[0].status).toBe("unkept");
    expect(statuses[0].insight).toBeDefined();
    vi.restoreAllMocks();
  });

  it("returns pending when still inside expected window with no result", async () => {
    vi.mocked(callGemini).mockResolvedValue(
      JSON.stringify({
        explanation: "The order exists and the due date has not passed.",
        clinicalSignificance: "medium",
        recommendedAction: "Monitor for incoming result.",
      })
    );

    const inWindowPromise = makePromise({
      timeframe: {
        relativeTerm: "in 3 weeks",
        earliest: "2099-01-01",
        latest: "2099-01-15",
        referenceDate: "2098-12-20",
      },
    });
    const client = new MockFhirClient((resourceType) => {
      if (resourceType === "ServiceRequest") {
        return { resourceType: "Bundle", entry: [{ resource: { resourceType: "ServiceRequest", id: "sr-1" } }] };
      }
      return { resourceType: "Bundle", entry: [] };
    });

    const statuses = await checkPromises(client as never, [inWindowPromise]);
    expect(statuses[0].status).toBe("pending");
    expect(statuses[0].insight).toBeDefined();
    vi.restoreAllMocks();
  });

  it("uses fallback insight when Gemini fails", async () => {
    vi.mocked(callGemini).mockRejectedValue(new Error("Gemini unavailable"));

    const pastDuePromise = makePromise({
      timeframe: {
        relativeTerm: "in 3 weeks",
        earliest: "2024-01-01",
        latest: "2024-01-15",
        referenceDate: "2023-12-20",
      },
    });
    const client = new MockFhirClient(() => ({ resourceType: "Bundle", entry: [] }));

    const statuses = await checkPromises(client as never, [pastDuePromise]);
    expect(statuses[0].status).toBe("unkept");
    expect(statuses[0].insight).toMatchObject({
      clinicalSignificance: "medium",
      recommendedAction: "Place lab order or verify with ordering provider",
    });
    vi.restoreAllMocks();
  });

  it("returns indeterminate when FHIR searchWithFallback throws", async () => {
    const client = {
      searchWithFallback: async () => {
        throw new Error("FHIR unavailable");
      },
    };

    const statuses = await checkPromises(client as never, [makePromise()]);
    expect(statuses[0].status).toBe("indeterminate");
    expect(statuses[0].reason).toContain("FHIR verification error");
  });

  it("returns unkept when search fails but fallback yields empty bundle (demo path)", async () => {
    const pastDue = makePromise({
      timeframe: {
        relativeTerm: "in 3 weeks",
        earliest: "2024-01-01",
        latest: "2024-01-15",
        referenceDate: "2023-12-20",
      },
    });
    const client = new FhirClient({
      fhirServerUrl: "https://example.com/fhir",
      fhirAccessToken: "token",
      patientId: "pat-1",
    });
    vi.spyOn(client, "search").mockRejectedValue(new Error("unreachable"));
    const statuses = await checkPromises(client, [pastDue]);
    expect(statuses[0].status).toBe("unkept");
    vi.restoreAllMocks();
  });
});

describe("FhirClient.searchWithFallback", () => {
  it("returns mock empty Bundle when search throws", async () => {
    const client = new FhirClient({
      fhirServerUrl: "https://example.com/fhir",
      fhirAccessToken: "token",
      patientId: "p1",
    });
    vi.spyOn(client, "search").mockRejectedValue(new Error("network error"));
    const result = await client.searchWithFallback("Observation", { patient: "x" });
    expect(result).toEqual({
      resourceType: "Bundle",
      total: 0,
      entry: [],
    });
    vi.restoreAllMocks();
  });
});

describe("generateTasks", () => {
  function makeUnkeptStatus(latest: string): PromiseStatus {
    return {
      promise: makePromise({
        timeframe: {
          relativeTerm: "in 3 weeks",
          earliest: "2026-03-15",
          latest,
          referenceDate: "2026-03-01",
        },
      }),
      status: "unkept",
      reason: "No result",
      checkedAt: new Date().toISOString(),
    };
  }

  it("creates valid FHIR Task for unkept promise", () => {
    const tasks = generateTasks("pat-1", [makeUnkeptStatus("2026-03-29")]);
    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({
      resourceType: "Task",
      status: "draft",
      intent: "proposal",
      for: { reference: "Patient/pat-1" },
      focus: { reference: "DocumentReference/doc-1" },
    });
  });

  it("sets urgent priority when past due and routine when within window", () => {
    const pastDue = makeUnkeptStatus("2000-01-01");
    const future = makeUnkeptStatus("2099-01-01");
    const tasks = generateTasks("pat-1", [pastDue, future]);
    expect(tasks[0].priority).toBe("urgent");
    expect(tasks[1].priority).toBe("routine");
  });
});
