import { describe, expect, it } from "vitest";
import { checkPromises } from "../src/promises/checker.js";
import { generateTasks } from "../src/tasks/generator.js";
import type { ClinicalPromise, PromiseStatus } from "../src/promises/types.js";

type SearchResponse = Record<string, unknown>;

class MockFhirClient {
  constructor(private readonly responder: (resourceType: string) => SearchResponse) {}

  async search<T extends Record<string, unknown>>(resourceType: string): Promise<T> {
    return this.responder(resourceType) as T;
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
  it("returns kept when matching Observation exists", async () => {
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
  });

  it("returns unkept when no matching resources are found", async () => {
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
  });

  it("returns pending when still inside expected window with no result", async () => {
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
  });

  it("returns indeterminate when FHIR query throws", async () => {
    const client = {
      search: async () => {
        throw new Error("FHIR unavailable");
      },
    };

    const statuses = await checkPromises(client as never, [makePromise()]);
    expect(statuses[0].status).toBe("indeterminate");
    expect(statuses[0].reason).toContain("FHIR verification error");
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
