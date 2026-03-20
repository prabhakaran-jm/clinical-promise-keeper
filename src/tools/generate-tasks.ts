import { FhirClient } from "../fhir/client.js";
import { generateTasks } from "../tasks/generator.js";
import type { PromiseStatus } from "../promises/types.js";
import { getContext } from "../sharp/context.js";

type GenerateTasksInput = {
  patientId?: string;
  unkeptPromises?: PromiseStatus[];
  writeback?: boolean;
};

type ToolExtra = {
  requestInfo?: {
    headers: Record<string, string | string[] | undefined>;
  };
};

export async function generateTasksTool(
  input: GenerateTasksInput,
  extra?: ToolExtra
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  try {
    if (!Array.isArray(input.unkeptPromises)) {
      throw new Error("unkeptPromises must be an array.");
    }

    const headers = extra?.requestInfo?.headers ?? {};
    const context = getContext(headers);
    const patientId = input.patientId ?? context.patientId;
    const tasks = generateTasks(patientId, input.unkeptPromises);

    if (input.writeback === true) {
      const client = new FhirClient(context);
      for (const task of tasks) {
        await client.create("Task", task as unknown as Record<string, unknown>);
      }
    }

    return {
      content: [{ type: "text", text: JSON.stringify(tasks, null, 2) }],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[generate_tasks] Error:", message);
    return {
      content: [{ type: "text", text: `generate_tasks failed: ${message}` }],
    };
  }
}
