import type { FhirClient } from "./client.js";
import type {
  FhirAppointment,
  FhirBundle,
  FhirDiagnosticReport,
  FhirDocumentReference,
  FhirObservation,
  FhirResource,
  FhirServiceRequest,
} from "./resources.js";

type SearchBundle<T> = FhirBundle<T> & Record<string, unknown>;

function fromBundle<T extends FhirResource>(bundle: SearchBundle<T>): T[] {
  if (!bundle.entry) {
    return [];
  }
  return bundle.entry.map((entry) => entry.resource).filter(Boolean);
}

export async function findServiceRequests(
  client: FhirClient,
  patientId: string,
  code?: string,
  dateFrom?: string
): Promise<FhirServiceRequest[]> {
  const params: Record<string, string | string[]> = { patient: patientId };
  if (code) {
    params.code = code;
  }
  if (dateFrom) {
    params.authored = `ge${dateFrom}`;
  }
  const bundle = await client.searchWithFallback<SearchBundle<FhirServiceRequest>>("ServiceRequest", params);
  return fromBundle(bundle);
}

export async function findObservations(
  client: FhirClient,
  patientId: string,
  code?: string,
  dateFrom?: string,
  dateTo?: string
): Promise<FhirObservation[]> {
  const params: Record<string, string | string[]> = { patient: patientId };
  const dateFilters: string[] = [];
  if (code) {
    params.code = code;
  }
  if (dateFrom) {
    dateFilters.push(`ge${dateFrom}`);
  }
  if (dateTo) {
    dateFilters.push(`le${dateTo}`);
  }
  if (dateFilters.length === 1) {
    params.date = dateFilters[0];
  } else if (dateFilters.length > 1) {
    params.date = dateFilters;
  }
  const bundle = await client.searchWithFallback<SearchBundle<FhirObservation>>("Observation", params);
  return fromBundle(bundle);
}

export async function findAppointments(
  client: FhirClient,
  patientId: string,
  dateFrom?: string,
  dateTo?: string
): Promise<FhirAppointment[]> {
  const params: Record<string, string | string[]> = {
    patient: patientId,
    status: "booked,fulfilled",
  };
  const dateFilters: string[] = [];
  if (dateFrom) {
    dateFilters.push(`ge${dateFrom}`);
  }
  if (dateTo) {
    dateFilters.push(`le${dateTo}`);
  }
  if (dateFilters.length === 1) {
    params.date = dateFilters[0];
  } else if (dateFilters.length > 1) {
    params.date = dateFilters;
  }
  const bundle = await client.searchWithFallback<SearchBundle<FhirAppointment>>("Appointment", params);
  return fromBundle(bundle);
}

export async function findDiagnosticReports(
  client: FhirClient,
  patientId: string,
  code?: string,
  dateFrom?: string,
  dateTo?: string
): Promise<FhirDiagnosticReport[]> {
  const params: Record<string, string | string[]> = { patient: patientId };
  const dateFilters: string[] = [];
  if (code) {
    params.code = code;
  }
  if (dateFrom) {
    dateFilters.push(`ge${dateFrom}`);
  }
  if (dateTo) {
    dateFilters.push(`le${dateTo}`);
  }
  if (dateFilters.length === 1) {
    params.date = dateFilters[0];
  } else if (dateFilters.length > 1) {
    params.date = dateFilters;
  }
  const bundle = await client.searchWithFallback<SearchBundle<FhirDiagnosticReport>>("DiagnosticReport", params);
  return fromBundle(bundle);
}

export async function findDocumentReferences(
  client: FhirClient,
  patientId: string,
  type?: string,
  dateFrom?: string
): Promise<FhirDocumentReference[]> {
  const params: Record<string, string | string[]> = { patient: patientId };
  if (type) {
    params.type = type;
  }
  if (dateFrom) {
    params.date = `ge${dateFrom}`;
  }
  const bundle = await client.searchWithFallback<SearchBundle<FhirDocumentReference>>("DocumentReference", params);
  return fromBundle(bundle);
}
