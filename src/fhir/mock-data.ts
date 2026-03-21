// Mock responses for demo reliability
// Only used when real FHIR queries fail

export const MOCK_OBSERVATIONS: Record<string, unknown[]> = {};
export const MOCK_SERVICE_REQUESTS: Record<string, unknown[]> = {};
export const MOCK_APPOINTMENTS: Record<string, unknown[]> = {};
export const MOCK_DIAGNOSTIC_REPORTS: Record<string, unknown[]> = {};
export const MOCK_DOCUMENT_REFERENCES: Record<string, unknown[]> = {};

// Return empty arrays by default — this simulates "no fulfillment found"
// which is the most useful demo scenario (shows unkept promises)
export function getMockResponse(resourceType: string, _params: Record<string, unknown>): {
  resourceType: "Bundle";
  total: number;
  entry: [];
} {
  void resourceType;
  void _params;
  return {
    resourceType: "Bundle",
    total: 0,
    entry: [],
  };
}
