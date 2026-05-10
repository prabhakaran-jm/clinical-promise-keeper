import { FhirClient } from "../fhir/client.js";
import { checkPromises } from "../promises/checker.js";
import type { ClinicalPromise } from "../promises/types.js";
import { getContext } from "../sharp/context.js";
import { wrapWithDisclaimer } from "../utils/disclaimers.js";

type CheckPromisesInput = {
  patientId?: string;
  promises?: ClinicalPromise[];
};

type ToolExtra = {
  requestInfo?: {
    headers: Record<string, string | string[] | undefined>;
  };
};

export async function checkPromisesTool(
  input: CheckPromisesInput,
  extra?: ToolExtra
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  try {
    if (!Array.isArray(input.promises)) {
      throw new Error("promises must be an array.");
    }

    const headers = extra?.requestInfo?.headers ?? {};
    const context = getContext(headers);
    const client = new FhirClient(context);
    const promises =
      input.patientId !== undefined
        ? input.promises.map((promise) => ({ ...promise, patientId: input.patientId as string }))
        : input.promises;
    const statuses = await checkPromises(client, promises);

    const output = {
      statuses,
      sharpContext: {
        fhirServerUrl: context.fhirServerUrl,
        patientId: context.patientId,
        contextPropagated: true,
      },
      ...(client.mockDataUsed ? { warning: "FHIR server unreachable — verification used demo fallback data." } : {}),
    };

    return {
      content: [
        {
          type: "text" as const,
          text: wrapWithDisclaimer(JSON.stringify(output, null, 2), "analysis"),
        },
      ],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[check_promises] Error:", message);
    return {
      content: [{ type: "text", text: `check_promises failed: ${message}` }],
    };
  }
}
