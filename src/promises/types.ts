export interface ClinicalPromise {
  id: string;
  sourceDocumentId: string;
  sourceText: string;
  patientId: string;
  class: "lab" | "appointment" | "imaging_document";
  description: string;
  expectedAction: {
    type: string;
    code?: string;
    codeSystem?: string;
    displayName?: string;
  };
  timeframe: {
    relativeTerm: string;
    earliest: string;
    latest: string;
    referenceDate: string;
  };
  confidence: number;
  /** "high" (>=0.8), "medium" (0.3–0.8), derived from confidence score */
  confidenceLevel: "high" | "medium";
}

export interface PromiseStatus {
  promise: ClinicalPromise;
  status: "kept" | "unkept" | "pending" | "indeterminate";
  evidence?: {
    resourceType: string;
    resourceId: string;
    date?: string;
    summary: string;
  };
  reason?: string;
  checkedAt: string;
}
