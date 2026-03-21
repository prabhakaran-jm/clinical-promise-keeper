import type { FhirClient } from "../fhir/client.js";
import {
  findAppointments,
  findDiagnosticReports,
  findDocumentReferences,
  findObservations,
  findServiceRequests,
} from "../fhir/queries.js";
import { generateVerificationInsight } from "../llm/verifier.js";
import type { ClinicalPromise, PromiseStatus } from "./types.js";

function todayIsoDate(): string {
  return new Date().toISOString().split("T")[0];
}

function nowIso(): string {
  return new Date().toISOString();
}

function makeEvidence(resourceType: string, resourceId: string | undefined, summary: string, date?: string) {
  return {
    resourceType,
    resourceId: resourceId ?? "unknown",
    date: date ?? "",
    summary,
  };
}

async function checkLabPromise(client: FhirClient, promise: ClinicalPromise): Promise<PromiseStatus> {
  const today = todayIsoDate();
  const code = promise.expectedAction.code;
  const serviceRequests = await findServiceRequests(
    client,
    promise.patientId,
    code,
    promise.timeframe.referenceDate
  );

  if (serviceRequests.length === 0) {
    return {
      promise,
      status: "unkept",
      reason: "No lab order found",
      checkedAt: nowIso(),
    };
  }

  const observations = await findObservations(
    client,
    promise.patientId,
    code,
    promise.timeframe.earliest,
    promise.timeframe.latest
  );

  if (observations.length > 0) {
    const obs = observations[0];
    return {
      promise,
      status: "kept",
      evidence: makeEvidence(
        "Observation",
        obs.id,
        "Matching lab result found in expected timeframe.",
        obs.effectiveDateTime
      ),
      checkedAt: nowIso(),
    };
  }

  if (today < promise.timeframe.latest) {
    return {
      promise,
      status: "pending",
      reason: "Lab order placed; awaiting result in current window.",
      checkedAt: nowIso(),
    };
  }

  return {
    promise,
    status: "unkept",
    reason: "Order placed but no result in expected window",
    checkedAt: nowIso(),
  };
}

async function checkAppointmentPromise(client: FhirClient, promise: ClinicalPromise): Promise<PromiseStatus> {
  const today = todayIsoDate();
  const appointments = await findAppointments(
    client,
    promise.patientId,
    promise.timeframe.earliest,
    promise.timeframe.latest
  );

  const fulfilled = appointments.find((a) => a.status === "fulfilled");
  if (fulfilled) {
    return {
      promise,
      status: "kept",
      evidence: makeEvidence("Appointment", fulfilled.id, "Follow-up appointment completed.", fulfilled.end),
      checkedAt: nowIso(),
    };
  }

  const booked = appointments.find((a) => a.status === "booked");
  if (booked) {
    return {
      promise,
      status: "pending",
      evidence: makeEvidence("Appointment", booked.id, "Follow-up appointment is booked.", booked.start),
      checkedAt: nowIso(),
    };
  }

  if (today < promise.timeframe.latest) {
    return {
      promise,
      status: "pending",
      reason: "No matching appointment yet; still within expected window.",
      checkedAt: nowIso(),
    };
  }

  return {
    promise,
    status: "unkept",
    reason: "No follow-up appointment found in expected window",
    checkedAt: nowIso(),
  };
}

async function checkImagingOrDocumentPromise(
  client: FhirClient,
  promise: ClinicalPromise
): Promise<PromiseStatus> {
  const today = todayIsoDate();
  const code = promise.expectedAction.code;
  const reports = await findDiagnosticReports(
    client,
    promise.patientId,
    code,
    promise.timeframe.earliest,
    promise.timeframe.latest
  );

  if (reports.length > 0) {
    const report = reports[0];
    return {
      promise,
      status: "kept",
      evidence: makeEvidence(
        "DiagnosticReport",
        report.id,
        "Matching imaging diagnostic report found.",
        report.effectiveDateTime ?? report.issued
      ),
      checkedAt: nowIso(),
    };
  }

  const references = await findDocumentReferences(
    client,
    promise.patientId,
    promise.expectedAction.code ?? promise.expectedAction.displayName,
    promise.timeframe.earliest
  );

  if (references.length > 0) {
    const reference = references[0];
    return {
      promise,
      status: "kept",
      evidence: makeEvidence(
        "DocumentReference",
        reference.id,
        "Matching clinical document found for promise.",
        reference.date
      ),
      checkedAt: nowIso(),
    };
  }

  if (today < promise.timeframe.latest) {
    return {
      promise,
      status: "pending",
      reason: "No imaging/document result yet; still within expected window.",
      checkedAt: nowIso(),
    };
  }

  return {
    promise,
    status: "unkept",
    reason: "No imaging/document evidence found in expected window",
    checkedAt: nowIso(),
  };
}

export async function checkPromises(client: FhirClient, promises: ClinicalPromise[]): Promise<PromiseStatus[]> {
  const results: PromiseStatus[] = [];

  for (const promise of promises) {
    try {
      let status: PromiseStatus;
      if (promise.class === "lab") {
        status = await checkLabPromise(client, promise);
      } else if (promise.class === "appointment") {
        status = await checkAppointmentPromise(client, promise);
      } else {
        status = await checkImagingOrDocumentPromise(client, promise);
      }

      if (status.status === "unkept" || status.status === "pending") {
        try {
          status.insight = await generateVerificationInsight(
            promise,
            status.status,
            status.evidence,
            status.reason
          );
        } catch {
          // Non-fatal: insight is optional and status computation must still succeed.
        }
      }

      results.push(status);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      results.push({
        promise,
        status: "indeterminate",
        reason: `FHIR verification error: ${message}`,
        checkedAt: nowIso(),
      });
    }
  }

  return results;
}
