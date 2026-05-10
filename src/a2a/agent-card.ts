export const AGENT_CARD = {
  name: "Clinical Promise Keeper",
  description:
    "Extracts implicit and explicit clinical commitments from physician notes, verifies them against FHIR R4 patient records, and generates actionable follow-up tasks for unkept promises.",
  url: process.env.SERVICE_URL ?? "https://clinical-promise-keeper",
  version: "0.1.0",
  provider: {
    organization: "PromiseKeeper Health",
    url: "https://github.com/pjmasani/clinical-promise-keeper",
  },
  capabilities: {
    streaming: false,
    pushNotifications: false,
    stateTransitionHistory: false,
  },
  authentication: {
    schemes: ["sharp"],
    sharpHeaders: [
      "X-FHIR-Server-URL",
      "X-FHIR-Access-Token",
      "X-Patient-ID",
    ],
  },
  defaultInputModes: ["text"],
  defaultOutputModes: ["text"],
  skills: [
    {
      id: "extract-promises",
      name: "Extract Clinical Promises",
      description:
        "Analyzes clinical notes to extract implicit and explicit commitments (labs, appointments, imaging) using a 5-pass AI pipeline with few-shot chain-of-thought prompting and calibration.",
      tags: ["clinical-nlp", "extraction", "fhir"],
      examples: [
        "Extract promises from this clinical note",
        "What follow-ups were mentioned in the progress note?",
      ],
    },
    {
      id: "check-promises",
      name: "Verify Promise Fulfillment",
      description:
        "Cross-references extracted promises against FHIR R4 resources (ServiceRequest, Observation, Appointment, DiagnosticReport, DocumentReference) to determine kept, pending, or unkept status.",
      tags: ["fhir-verification", "multi-hop-query", "patient-safety"],
      examples: [
        "Check if this patient's follow-up labs were completed",
        "Verify which promises from last visit are still outstanding",
      ],
    },
    {
      id: "generate-tasks",
      name: "Generate FHIR Tasks",
      description:
        "Creates draft FHIR R4 Task resources for unkept clinical promises, ready for clinician review and EHR integration.",
      tags: ["fhir-write", "task-generation", "workflow"],
      examples: [
        "Create follow-up tasks for unkept promises",
        "Draft FHIR tasks for overdue lab orders",
      ],
    },
    {
      id: "promise-summary",
      name: "End-to-End Promise Analysis",
      description:
        "Full pipeline: extract promises from notes, verify against FHIR records, generate clinical narrative with prioritized action items and significance scoring.",
      tags: ["end-to-end", "clinical-narrative", "gap-analysis"],
      examples: [
        "Analyze this patient's follow-up gaps",
        "Give me a complete promise summary for this note",
      ],
    },
  ],
  supportsA2A: true,
  a2aCapabilities: {
    canConsult: true,
    canBeConsulted: true,
    collaborationPatterns: [
      {
        pattern: "promise-to-order",
        description:
          "Identifies unkept promises and sends structured consult to Clinical Order Assistant to draft corresponding FHIR ServiceRequests.",
        partnerRole: "Clinical Order Assistant",
        dataExchanged: ["unkept-promises", "patient-context", "loinc-codes"],
      },
    ],
  },
  fhirCapabilities: {
    fhirVersion: "R4",
    resourcesRead: [
      "ServiceRequest",
      "Observation",
      "Appointment",
      "DiagnosticReport",
      "DocumentReference",
    ],
    resourcesWrite: ["Task", "CommunicationRequest"],
    searchParameters: ["patient", "code", "date", "authored", "status", "type"],
  },
  clinicalSafety: {
    role: "clinical-decision-support",
    requiresClinicianReview: true,
    noAutonomousClinicalActions: true,
    validationMetrics: {
      f1Score: 0.812,
      recall: 0.844,
      precision: 0.783,
      notesValidated: 21,
      specialties: 8,
    },
  },
};
