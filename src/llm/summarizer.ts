import { callGemini } from "./gemini.js";

const SUMMARY_SYSTEM_PROMPT = `You are a clinical decision support system generating a concise follow-up gap analysis for a healthcare provider.

Given structured data about clinical promises (commitments made in physician notes) and their fulfillment status, generate a clear, actionable clinical summary.

Format your response as follows:

## Follow-Up Gap Analysis

**Patient:** [Patient ID]
**Analysis Date:** [Today's date]
**Notes Analyzed:** [Count]

### 🔴 Urgent — Past Due
[For each unkept promise past its due window, list:]
- **[Description]** — Originally noted: "[exact quote]". Due window: [earliest] to [latest]. Status: No corresponding [order/result/appointment] found in records. **Recommended action:** [specific next step].

### 🟡 Pending — Within Window  
[For each pending promise still within its due window:]
- **[Description]** — Due by [latest]. Currently awaiting [what's expected].

### 🟢 Completed
[For each kept promise:]
- **[Description]** — Fulfilled on [date] ([evidence summary]).

### Summary
[1-2 sentence overall assessment: how many gaps found, urgency level, recommended priority actions]

Rules:
- Be concise and clinically precise
- Use medical terminology appropriately
- Never fabricate data not present in the input
- If no promises were found, state that clearly
- Always note that this is AI-generated and requires clinician review
- Return plain markdown text, NOT JSON`;

export async function generateClinicalSummary(summaryData: Record<string, unknown>): Promise<string> {
  const userPrompt = `Generate a clinical follow-up gap analysis from this structured data:\n\n${JSON.stringify(summaryData, null, 2)}`;

  try {
    const narrative = await callGemini(SUMMARY_SYSTEM_PROMPT, userPrompt, {
      responseMimeType: "text/plain",
    });
    return narrative;
  } catch (error) {
    console.error("[Summarizer] Failed to generate narrative:", error);
    // Fallback: return the raw JSON if summarization fails
    return `## Follow-Up Gap Analysis\n\n_AI narrative generation unavailable. Raw analysis data:_\n\n\`\`\`json\n${JSON.stringify(summaryData, null, 2)}\n\`\`\``;
  }
}
