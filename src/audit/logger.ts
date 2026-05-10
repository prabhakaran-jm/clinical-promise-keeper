export interface AuditEntry {
  timestamp: string;
  method: string;
  toolName?: string;
  patientIdHash?: string;
  promiseCount?: number;
  unkeptCount?: number;
  pendingCount?: number;
  keptCount?: number;
  durationMs: number;
  status: "success" | "error";
  errorMessage?: string;
  sharpContextPresent: boolean;
  fhirServerDomain?: string;
  mockDataUsed?: boolean;
}

function hashId(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0;
  }
  return `pid_${Math.abs(hash).toString(36)}`;
}

function extractDomain(url?: string): string | undefined {
  if (!url) return undefined;
  try {
    return new URL(url).hostname;
  } catch {
    return "unknown";
  }
}

export function createAuditEntry(
  method: string,
  headers: Record<string, string | string[] | undefined>
): { entry: Partial<AuditEntry>; finish: (extra?: Partial<AuditEntry>) => void; startTime: number } {
  const startTime = Date.now();
  const patientId = headers["x-patient-id"];
  const fhirUrl = headers["x-fhir-server-url"];
  const hasToken = !!headers["x-fhir-access-token"];

  const entry: Partial<AuditEntry> = {
    timestamp: new Date().toISOString(),
    method,
    patientIdHash: patientId ? hashId(String(patientId)) : undefined,
    sharpContextPresent: !!(patientId && fhirUrl && hasToken),
    fhirServerDomain: extractDomain(fhirUrl ? String(fhirUrl) : undefined),
  };

  const finish = (extra?: Partial<AuditEntry>) => {
    const final: AuditEntry = {
      timestamp: entry.timestamp!,
      method: entry.method!,
      toolName: extra?.toolName ?? entry.toolName,
      patientIdHash: entry.patientIdHash,
      promiseCount: extra?.promiseCount,
      unkeptCount: extra?.unkeptCount,
      pendingCount: extra?.pendingCount,
      keptCount: extra?.keptCount,
      durationMs: Date.now() - startTime,
      status: extra?.status ?? "success",
      errorMessage: extra?.errorMessage,
      sharpContextPresent: entry.sharpContextPresent!,
      fhirServerDomain: entry.fhirServerDomain,
      mockDataUsed: extra?.mockDataUsed,
    };
    console.log(`[AUDIT] ${JSON.stringify(final)}`);
  };

  return { entry, finish, startTime };
}
