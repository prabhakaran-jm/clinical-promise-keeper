import type { FhirContext } from "../sharp/context.js";

type JsonObject = Record<string, unknown>;
export type SearchParamValue = string | number | boolean | undefined;
type SearchParams = Record<string, SearchParamValue | SearchParamValue[]>;

const FHIR_TIMEOUT_MS = 10_000;

export class FhirClient {
  constructor(private readonly context: FhirContext) {}

  async read<T extends JsonObject = JsonObject>(resourceType: string, id: string): Promise<T> {
    const url = new URL(`${this.context.fhirServerUrl.replace(/\/$/, "")}/${resourceType}/${id}`);
    return this.request<T>(url);
  }

  async search<T extends JsonObject = JsonObject>(
    resourceType: string,
    params: SearchParams = {}
  ): Promise<T> {
    const url = new URL(`${this.context.fhirServerUrl.replace(/\/$/, "")}/${resourceType}`);

    for (const [key, value] of Object.entries(params)) {
      if (Array.isArray(value)) {
        for (const item of value) {
          if (item !== undefined) {
            url.searchParams.append(key, String(item));
          }
        }
      } else if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }

    return this.request<T>(url);
  }

  async searchWithFallback<T extends JsonObject = JsonObject>(
    resourceType: string,
    params: Record<string, SearchParamValue | SearchParamValue[]>
  ): Promise<T> {
    try {
      return await this.search<T>(resourceType, params);
    } catch (error) {
      console.warn(
        `[FHIR] ${resourceType} search failed, using fallback:`,
        error instanceof Error ? error.message : error
      );
      const { getMockResponse } = await import("./mock-data.js");
      return getMockResponse(resourceType, params as Record<string, unknown>) as unknown as T;
    }
  }

  async create<T extends JsonObject = JsonObject>(resourceType: string, resource: JsonObject): Promise<T> {
    const url = new URL(`${this.context.fhirServerUrl.replace(/\/$/, "")}/${resourceType}`);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FHIR_TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        method: "POST",
        signal: controller.signal,
        headers: {
          Accept: "application/fhir+json, application/json",
          "Content-Type": "application/fhir+json",
          Authorization: `Bearer ${this.context.fhirAccessToken}`,
        },
        body: JSON.stringify(resource),
      });

      if (!response.ok) {
        throw new Error(`FHIR create failed (${response.status}): ${response.statusText}`);
      }

      return (await response.json()) as T;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private async request<T extends JsonObject>(url: URL): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FHIR_TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          Accept: "application/fhir+json, application/json",
          Authorization: `Bearer ${this.context.fhirAccessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(`FHIR request failed (${response.status}): ${response.statusText}`);
      }

      return (await response.json()) as T;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
