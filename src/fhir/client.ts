import type { FhirContext } from "../sharp/context.js";

type JsonObject = Record<string, unknown>;
type SearchParamValue = string | number | boolean | undefined;
type SearchParams = Record<string, SearchParamValue | SearchParamValue[]>;

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

  async create<T extends JsonObject = JsonObject>(resourceType: string, resource: JsonObject): Promise<T> {
    const url = new URL(`${this.context.fhirServerUrl.replace(/\/$/, "")}/${resourceType}`);
    const response = await fetch(url, {
      method: "POST",
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
  }

  private async request<T extends JsonObject>(url: URL): Promise<T> {
    const response = await fetch(url, {
      headers: {
        Accept: "application/fhir+json, application/json",
        Authorization: `Bearer ${this.context.fhirAccessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`FHIR request failed (${response.status}): ${response.statusText}`);
    }

    return (await response.json()) as T;
  }
}
