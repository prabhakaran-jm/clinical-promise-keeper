import type { FhirCommunicationRequest, FhirTask } from "../fhir/resources.js";
import type { PromiseStatus } from "../promises/types.js";

function todayIsoDate(): string {
  return new Date().toISOString().split("T")[0];
}

function determinePriority(promiseStatus: PromiseStatus): "routine" | "urgent" {
  return todayIsoDate() > promiseStatus.promise.timeframe.latest ? "urgent" : "routine";
}

export function generateTasks(patientId: string, unkeptPromises: PromiseStatus[]): FhirTask[] {
  return unkeptPromises.map((status) => ({
    resourceType: "Task",
    status: "draft",
    intent: "proposal",
    priority: determinePriority(status),
    code: {
      coding: [
        {
          system: "http://terminology.hl7.org/CodeSystem/task-code",
          code: "fulfill",
          display: "Fulfill the focal request",
        },
      ],
    },
    description: `Follow-up ${status.promise.class} (${status.promise.description}) was promised on ${status.promise.timeframe.referenceDate} but not completed. Due window: ${status.promise.timeframe.earliest} to ${status.promise.timeframe.latest}.`,
    for: { reference: `Patient/${patientId}` },
    focus: { reference: `DocumentReference/${status.promise.sourceDocumentId}` },
    authoredOn: new Date().toISOString(),
    restriction: {
      period: {
        start: status.promise.timeframe.earliest,
        end: status.promise.timeframe.latest,
      },
    },
    input: [
      {
        type: { text: "Original clinical note excerpt" },
        valueString: status.promise.sourceText,
      },
    ],
  }));
}

export function generateCommunicationRequests(
  patientId: string,
  unkeptPromises: PromiseStatus[]
): FhirCommunicationRequest[] {
  return unkeptPromises.map((status) => ({
    resourceType: "CommunicationRequest",
    status: "draft",
    subject: { reference: `Patient/${patientId}` },
    authoredOn: new Date().toISOString(),
    payload: [
      {
        contentString: `Unkept clinical promise detected: ${status.promise.description}. Due window ${status.promise.timeframe.earliest} to ${status.promise.timeframe.latest}.`,
      },
    ],
  }));
}
