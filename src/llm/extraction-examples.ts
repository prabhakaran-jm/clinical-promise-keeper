export const FEW_SHOT_EXAMPLES = [
  {
    noteExcerpt: `Assessment and Plan:
1. Type 2 Diabetes - A1c 7.8%, improved from 8.5%
   - Continue current regimen
   - Recheck A1c in 3 months
2. Hypertension - well controlled
   - Continue lisinopril 20mg daily
   - Follow up in 6 months`,
    noteDate: "2026-01-15",
    reasoning:
      "Sentence 'Recheck A1c in 3 months' implies a future lab order. 'Continue current regimen' is NOT a promise — it's maintaining status quo. 'Follow up in 6 months' implies a return visit.",
    promises: [
      {
        exactQuote: "Recheck A1c in 3 months",
        class: "lab",
        description: "Recheck Hemoglobin A1c to assess diabetes control trajectory",
        code: "4548-4",
        codeSystem: "http://loinc.org",
        displayName: "Hemoglobin A1c",
        relativeTerm: "in 3 months",
        confidence: 0.95,
      },
      {
        exactQuote: "Follow up in 6 months",
        class: "appointment",
        description: "Return visit for hypertension and diabetes management",
        code: null,
        codeSystem: null,
        displayName: "Follow-up visit",
        relativeTerm: "in 6 months",
        confidence: 0.85,
      },
    ],
  },
  {
    noteExcerpt: `Patient reports chest pain resolved after medication change. 
ECG today normal sinus rhythm.
- Recommend repeat echocardiogram in 6 weeks to reassess EF
- Need to obtain records from St. Mary's Hospital regarding prior cardiac cath
- Will call patient with lipid panel results when available`,
    noteDate: "2026-02-01",
    reasoning:
      "'Recommend repeat echocardiogram in 6 weeks' is an imaging promise with a clear timeframe. 'Need to obtain records from St. Mary's' is a document retrieval promise. 'Will call patient with lipid panel results' is an informational follow-up but the lipid panel itself was already done (results pending), so it is NOT a new lab promise — the action is communication, not ordering.",
    promises: [
      {
        exactQuote: "Recommend repeat echocardiogram in 6 weeks to reassess EF",
        class: "imaging_document",
        description: "Repeat echocardiogram to reassess ejection fraction",
        code: "93306",
        codeSystem: "http://www.ama-assn.org/go/cpt",
        displayName: "Echocardiogram",
        relativeTerm: "in 6 weeks",
        confidence: 0.92,
      },
      {
        exactQuote: "Need to obtain records from St. Mary's Hospital regarding prior cardiac cath",
        class: "imaging_document",
        description: "Obtain external cardiac catheterization records from St. Mary's Hospital",
        code: null,
        codeSystem: null,
        displayName: "External records - cardiac catheterization",
        relativeTerm: "soon",
        confidence: 0.8,
      },
    ],
  },
  {
    noteExcerpt: `Stable angina, no new symptoms.
Continue aspirin 81mg, atorvastatin 40mg.
Patient doing well overall. See you in 3 months.`,
    noteDate: "2026-02-10",
    reasoning:
      "'Continue aspirin' and 'Continue atorvastatin' are medication continuations, NOT promises. 'See you in 3 months' is a routine follow-up appointment promise.",
    promises: [
      {
        exactQuote: "See you in 3 months",
        class: "appointment",
        description: "Routine follow-up appointment for stable angina management",
        code: null,
        codeSystem: null,
        displayName: "Follow-up visit",
        relativeTerm: "in 3 months",
        confidence: 0.8,
      },
    ],
  },
];

export function buildFewShotPrompt(): string {
  return FEW_SHOT_EXAMPLES.map(
    (ex, i) =>
      `--- Example ${i + 1} ---
Note excerpt (date: ${ex.noteDate}):
${ex.noteExcerpt}

Reasoning: ${ex.reasoning}

Extracted promises:
${JSON.stringify(ex.promises, null, 2)}`
  ).join("\n\n");
}
