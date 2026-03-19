export interface FhirBundle<T> {
  resourceType: "Bundle";
  total?: number;
  entry?: Array<{ resource: T }>;
}

export interface FhirCoding {
  system?: string;
  code?: string;
  display?: string;
}

export interface FhirObservation {
  resourceType: "Observation";
  id?: string;
  status?: string;
  code?: { coding?: FhirCoding[] };
  effectiveDateTime?: string;
  valueQuantity?: { value?: number; unit?: string };
}

export interface FhirAppointment {
  resourceType: "Appointment";
  id?: string;
  status?: string;
  start?: string;
  end?: string;
}

export interface FhirDiagnosticReport {
  resourceType: "DiagnosticReport";
  id?: string;
  status?: string;
  code?: { coding?: FhirCoding[] };
  effectiveDateTime?: string;
  issued?: string;
}

export interface FhirServiceRequest {
  resourceType: "ServiceRequest";
  id?: string;
  status?: string;
  code?: { coding?: FhirCoding[] };
  authoredOn?: string;
}

export interface FhirDocumentReference {
  resourceType: "DocumentReference";
  id?: string;
  status?: string;
  type?: { coding?: FhirCoding[] };
  date?: string;
  description?: string;
  content?: Array<{
    attachment?: {
      contentType?: string;
      data?: string;
      url?: string;
      title?: string;
    };
  }>;
}

export interface FhirTask {
  resourceType: "Task";
  status: "draft";
  intent: "proposal";
  priority: "routine" | "urgent";
  code: { coding: Array<{ system: string; code: string; display: string }> };
  description: string;
  for: { reference: string };
  focus: { reference: string };
  authoredOn: string;
  restriction: { period: { start: string; end: string } };
  input: Array<{ type: { text: string }; valueString: string }>;
}

export interface FhirCommunicationRequest {
  resourceType: "CommunicationRequest";
  status: "draft";
  subject: { reference: string };
  authoredOn: string;
  payload: Array<{ contentString: string }>;
}

export type FhirResource =
  | FhirObservation
  | FhirAppointment
  | FhirDiagnosticReport
  | FhirServiceRequest
  | FhirDocumentReference
  | FhirTask
  | FhirCommunicationRequest
  | Record<string, unknown>;
