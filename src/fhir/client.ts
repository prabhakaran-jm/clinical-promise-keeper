import type { FhirContext } from "../sharp/context.js";

type JsonObject = Record<string, unknown>;
type SearchParams = Record<string, string | number | boolean | undefined>;

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
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }

    return this.request<T>(url);
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
