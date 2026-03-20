import type { FhirCommunicationRequest, FhirTask } from "../fhir/resources.js";
import type { PromiseStatus } from "../promises/types.js";

function todayIsoDate(): string {
  return new Date().toISOString().split("T")[0];
}

type SimplifiedTask = {
  title?: string;
  description?: string;
  priority?: string;
  status?: string;
  dueDate?: string;
};

function isFullPromiseStatus(item: unknown): item is PromiseStatus {
  return (
    typeof item === "object" &&
    item !== null &&
    "promise" in item &&
    typeof (item as PromiseStatus).promise?.timeframe?.latest === "string"
  );
}

function determinePriority(promiseStatus: PromiseStatus): "routine" | "urgent" {
  return todayIsoDate() > promiseStatus.promise.timeframe.latest ? "urgent" : "routine";
}

function taskFromFull(patientId: string, status: PromiseStatus): FhirTask {
  return {
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
  };
}

function taskFromSimplified(patientId: string, item: SimplifiedTask): FhirTask {
  const dueDate = item.dueDate ?? todayIsoDate();
  const isPastDue = todayIsoDate() > dueDate;
  return {
    resourceType: "Task",
    status: "draft",
    intent: "proposal",
    priority: item.priority === "urgent" || item.priority === "medium" || isPastDue ? "urgent" : "routine",
    code: {
      coding: [
        {
          system: "http://terminology.hl7.org/CodeSystem/task-code",
          code: "fulfill",
          display: "Fulfill the focal request",
        },
      ],
    },
    description: item.description ?? item.title ?? "Follow-up task",
    for: { reference: `Patient/${patientId}` },
    authoredOn: new Date().toISOString(),
    restriction: {
      period: {
        start: todayIsoDate(),
        end: dueDate,
      },
    },
  };
}

export function generateTasks(patientId: string, unkeptPromises: unknown[]): FhirTask[] {
  return unkeptPromises.map((item) => {
    if (isFullPromiseStatus(item)) {
      return taskFromFull(patientId, item);
    }
    return taskFromSimplified(patientId, item as SimplifiedTask);
  });
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
