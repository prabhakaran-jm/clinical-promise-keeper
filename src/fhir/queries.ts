export type FhirQueryParams = Record<string, string | number | boolean | undefined>;

export function buildQueryParams(params: FhirQueryParams): URLSearchParams {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      searchParams.set(key, String(value));
    }
  }

  return searchParams;
}
