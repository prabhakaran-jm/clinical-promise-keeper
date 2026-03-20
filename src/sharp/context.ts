import type { IncomingHttpHeaders } from "node:http";

export interface FhirContext {
  fhirServerUrl: string;
  fhirAccessToken: string;
  patientId: string;
}

export class ForbiddenError extends Error {
  readonly statusCode = 403;

  constructor(message: string) {
    super(message);
    this.name = "ForbiddenError";
  }
}

type HeaderInput = Headers | IncomingHttpHeaders | Record<string, string | string[] | undefined>;

function readHeader(headers: HeaderInput, name: string): string | undefined {
  const lowerName = name.toLowerCase();

  if (headers instanceof Headers) {
    return headers.get(name) ?? headers.get(lowerName) ?? undefined;
  }

  const value = headers[lowerName] ?? headers[name];
  if (Array.isArray(value)) {
    return value[0];
  }
  return value ?? undefined;
}

export function getContext(headers: HeaderInput): FhirContext {
  const fhirServerUrl = readHeader(headers, "X-FHIR-Server-URL");
  const fhirAccessToken = readHeader(headers, "X-FHIR-Access-Token");
  const patientId = readHeader(headers, "X-Patient-ID");

  if (!fhirServerUrl || !fhirAccessToken || !patientId) {
    throw new ForbiddenError(
      "Missing required SHARP context headers: X-FHIR-Server-URL, X-FHIR-Access-Token, X-Patient-ID"
    );
  }

  return {
    fhirServerUrl,
    fhirAccessToken,
    patientId,
  };
}
