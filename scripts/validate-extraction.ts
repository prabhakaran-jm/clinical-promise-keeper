import { writeFileSync } from "node:fs";
import { extractPromises } from "../src/promises/extractor.js";
import { validationNotes } from "../test/fixtures/validation-notes.js";
import type { ClinicalPromise } from "../src/promises/types.js";

interface MatchResult {
  noteId: string;
  specialty: string;
  expected: number;
  extracted: number;
  truePositives: number;
  falsePositives: number;
  falseNegatives: number;
  details: string[];
}

type PromiseClass = "lab" | "appointment" | "imaging_document";

function fuzzyMatch(extracted: string, expected: string): boolean {
  const e = extracted.toLowerCase();
  const x = expected.toLowerCase();

  if (e.includes(x) || x.includes(e)) return true;

  const normalize = (s: string): string =>
    s
      .replace(/hemoglobin a1c|hba1c|a1c/gi, "a1c")
      .replace(/basic metabolic panel|bmp/gi, "bmp")
      .replace(/complete blood count|cbc/gi, "cbc")
      .replace(/comprehensive metabolic panel|cmp/gi, "cmp")
      .replace(/thyroid stimulating hormone|tsh/gi, "tsh")
      .replace(/pulmonary function test[s]?|pfts?/gi, "pft")
      .replace(/low.?dose ct|ldct/gi, "ldct")
      .replace(/electrocardiogram|ecg|ekg/gi, "ecg")
      .replace(/follow.?up|return|f\/u/gi, "followup")
      .replace(/referral|refer/gi, "referral")
      .replace(/recheck|re-check|repeat|re-order/gi, "recheck")
      .replace(/visit|appointment|check-up/gi, "visit")
      .replace(/ophthalmology|eye exam|dilated eye/gi, "eye")
      .replace(/colonoscopy|colon screening/gi, "colonoscopy")
      .replace(/mammogram|mammography/gi, "mammogram")
      .replace(/outside|external/gi, "external")
      .replace(/records|notes|documentation/gi, "records")
      .replace(/\s+/g, " ")
      .trim();

  const ne = normalize(e);
  const nx = normalize(x);

  if (ne.includes(nx) || nx.includes(ne)) return true;

  const fillerWords = new Set([
    "with",
    "from",
    "follow",
    "visit",
    "check",
    "order",
    "need",
    "schedule",
    "review",
    "assess",
    "monitor",
    "evaluate",
    "obtain",
    "request",
    "perform",
    "complete",
    "routine",
    "annual",
    "patient",
    "clinical",
    "care",
    "management",
    "therapy",
    "treatment",
    "test",
    "level",
    "panel",
    "exam",
    "screening",
    "that",
    "this",
    "will",
    "also",
    "should",
    "pending",
    "overdue",
    "based",
    "given",
    "post",
    "follow-up",
    "followup",
    "return",
    "recheck",
    "due",
    "new",
  ]);

  const extractKeywords = (s: string): string[] =>
    normalize(s)
      .split(/[\s,\-\/]+/)
      .filter((word) => word.length > 2 && !fillerWords.has(word));

  const eKeywords = extractKeywords(e);
  const xKeywords = extractKeywords(x);

  if (xKeywords.length === 0) return eKeywords.length === 0;

  const matchCount = xKeywords.filter((kw) =>
    eKeywords.some((ek) => ek.includes(kw) || kw.includes(ek))
  ).length;

  return matchCount >= Math.max(1, Math.ceil(xKeywords.length * 0.4));
}

function classesCompatible(extractedClass: PromiseClass, expectedClass: PromiseClass): boolean {
  if (extractedClass === expectedClass) return true;

  const flexiblePairs: Array<[PromiseClass, PromiseClass]> = [
    ["lab", "imaging_document"],
    ["appointment", "imaging_document"],
    ["lab", "appointment"],
  ];

  return flexiblePairs.some(
    ([a, b]) =>
      (extractedClass === a && expectedClass === b) || (extractedClass === b && expectedClass === a)
  );
}

type EvalMode = "strict" | "flexible";

function evaluateNote(
  extracted: ClinicalPromise[],
  expectedPromises: Array<{ description: string; class: PromiseClass }>,
  mode: EvalMode
): {
  tp: number;
  fp: number;
  fn: number;
  details: string[];
  classCounts: Record<PromiseClass, { tp: number; fp: number; fn: number }>;
} {
  const matchedExpected = new Set<number>();
  const details: string[] = [];
  const classCounts: Record<PromiseClass, { tp: number; fp: number; fn: number }> = {
    lab: { tp: 0, fp: 0, fn: 0 },
    appointment: { tp: 0, fp: 0, fn: 0 },
    imaging_document: { tp: 0, fp: 0, fn: 0 },
  };

  for (let extractedIdx = 0; extractedIdx < extracted.length; extractedIdx++) {
    let found = false;
    for (let expectedIdx = 0; expectedIdx < expectedPromises.length; expectedIdx++) {
      if (matchedExpected.has(expectedIdx)) continue;
      const expected = expectedPromises[expectedIdx];
      const candidate = extracted[extractedIdx];
      const classMatch =
        mode === "flexible"
          ? classesCompatible(candidate.class as PromiseClass, expected.class)
          : candidate.class === expected.class;
      if (classMatch && fuzzyMatch(candidate.description, expected.description)) {
        matchedExpected.add(expectedIdx);
        found = true;
        const classTag = candidate.class === expected.class ? "" : " [class-flex]";
        details.push(
          `  [MATCH/${mode}] "${candidate.description}" (${candidate.class}) <-> "${expected.description}" (${expected.class})${classTag}`
        );
        classCounts[expected.class].tp++;
        break;
      }
    }
    if (!found) {
      const candidate = extracted[extractedIdx];
      details.push(`  [FP/${mode}] "${candidate.description}" (${candidate.class}) - not in expected`);
      classCounts[candidate.class as PromiseClass].fp++;
    }
  }

  for (let expectedIdx = 0; expectedIdx < expectedPromises.length; expectedIdx++) {
    if (!matchedExpected.has(expectedIdx)) {
      const expected = expectedPromises[expectedIdx];
      details.push(`  [FN/${mode}] "${expected.description}" (${expected.class}) - not extracted`);
      classCounts[expected.class].fn++;
    }
  }

  const tp = matchedExpected.size;
  const fp = extracted.length - tp;
  const fn = expectedPromises.length - tp;

  return { tp, fp, fn, details, classCounts };
}

async function runValidation(): Promise<void> {
  const lines: string[] = [];
  const log = (line = ""): void => {
    lines.push(line);
    console.log(line);
  };

  log("╔══════════════════════════════════════════════════════════════╗");
  log("║     Clinical Promise Keeper — Extraction Validation Suite   ║");
  log("╚══════════════════════════════════════════════════════════════╝");
  log();

  const results: MatchResult[] = [];
  const strictResults: MatchResult[] = [];
  let totalExpected = 0;
  let totalExtracted = 0;
  let totalTP = 0;
  let totalFP = 0;
  let totalFN = 0;
  let strictTotalTP = 0;
  let strictTotalFP = 0;
  let strictTotalFN = 0;
  const classCounts: Record<PromiseClass, { tp: number; fp: number; fn: number }> = {
    lab: { tp: 0, fp: 0, fn: 0 },
    appointment: { tp: 0, fp: 0, fn: 0 },
    imaging_document: { tp: 0, fp: 0, fn: 0 },
  };

  for (const note of validationNotes) {
    log(`Processing [${note.id}] ${note.specialty}...`);
    try {
      const extracted = await extractPromises(note.noteText, note.noteDate, `validation-${note.id}`);
      const strict = evaluateNote(extracted, note.expectedPromises, "strict");
      const flexible = evaluateNote(extracted, note.expectedPromises, "flexible");

      for (const cls of Object.keys(classCounts) as PromiseClass[]) {
        classCounts[cls].tp += flexible.classCounts[cls].tp;
        classCounts[cls].fp += flexible.classCounts[cls].fp;
        classCounts[cls].fn += flexible.classCounts[cls].fn;
      }

      results.push({
        noteId: note.id,
        specialty: note.specialty,
        expected: note.expectedPromises.length,
        extracted: extracted.length,
        truePositives: flexible.tp,
        falsePositives: flexible.fp,
        falseNegatives: flexible.fn,
        details: [...strict.details, ...flexible.details],
      });
      strictResults.push({
        noteId: note.id,
        specialty: note.specialty,
        expected: note.expectedPromises.length,
        extracted: extracted.length,
        truePositives: strict.tp,
        falsePositives: strict.fp,
        falseNegatives: strict.fn,
        details: strict.details,
      });

      totalExpected += note.expectedPromises.length;
      totalExtracted += extracted.length;
      totalTP += flexible.tp;
      totalFP += flexible.fp;
      totalFN += flexible.fn;
      strictTotalTP += strict.tp;
      strictTotalFP += strict.fp;
      strictTotalFN += strict.fn;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log(`  ERROR on ${note.id}: ${message}`);
      for (const expected of note.expectedPromises) {
        classCounts[expected.class].fn++;
      }
      results.push({
        noteId: note.id,
        specialty: note.specialty,
        expected: note.expectedPromises.length,
        extracted: 0,
        truePositives: 0,
        falsePositives: 0,
        falseNegatives: note.expectedPromises.length,
        details: [`  [ERROR] ${message}`],
      });
      strictResults.push({
        noteId: note.id,
        specialty: note.specialty,
        expected: note.expectedPromises.length,
        extracted: 0,
        truePositives: 0,
        falsePositives: 0,
        falseNegatives: note.expectedPromises.length,
        details: [`  [ERROR] ${message}`],
      });
      totalExpected += note.expectedPromises.length;
      totalFN += note.expectedPromises.length;
      strictTotalFN += note.expectedPromises.length;
    }
  }

  log();
  log("=".repeat(70));
  log("DETAILED RESULTS");
  log("=".repeat(70));

  for (const result of results) {
    const precision =
      result.extracted > 0 ? ((result.truePositives / result.extracted) * 100).toFixed(0) : "N/A";
    const recall =
      result.expected > 0 ? ((result.truePositives / result.expected) * 100).toFixed(0) : "100";
    log();
    log(
      `[${result.noteId}] ${result.specialty} - Expected: ${result.expected}, Extracted: ${result.extracted}, TP: ${result.truePositives}, FP: ${result.falsePositives}, FN: ${result.falseNegatives} | P: ${precision}% R: ${recall}%`
    );
    result.details.forEach((detail) => log(detail));
  }

  const precision = totalExtracted > 0 ? totalTP / totalExtracted : 0;
  const recall = totalExpected > 0 ? totalTP / totalExpected : 0;
  const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
  const strictPrecision = totalExtracted > 0 ? strictTotalTP / totalExtracted : 0;
  const strictRecall = totalExpected > 0 ? strictTotalTP / totalExpected : 0;
  const strictF1 =
    strictPrecision + strictRecall > 0
      ? (2 * strictPrecision * strictRecall) / (strictPrecision + strictRecall)
      : 0;
  const falsePositiveRate = totalExtracted > 0 ? totalFP / totalExtracted : 0;
  const falseNegativeRate = totalExpected > 0 ? totalFN / totalExpected : 0;

  log();
  log("=".repeat(70));
  log("AGGREGATE METRICS");
  log("=".repeat(70));
  log(`Notes analyzed:      ${validationNotes.length}`);
  log(`Total expected:      ${totalExpected}`);
  log(`Total extracted:     ${totalExtracted}`);
  log(`True positives:      ${totalTP}`);
  log(`False positives:     ${totalFP}`);
  log(`False negatives:     ${totalFN}`);
  log(`Strict TP/FP/FN:     ${strictTotalTP}/${strictTotalFP}/${strictTotalFN}`);
  log(`Strict Precision:    ${(strictPrecision * 100).toFixed(1)}%`);
  log(`Strict Recall:       ${(strictRecall * 100).toFixed(1)}%`);
  log(`Strict F1 Score:     ${(strictF1 * 100).toFixed(1)}%`);
  log(`Flexible Precision:  ${(precision * 100).toFixed(1)}%`);
  log(`Flexible Recall:     ${(recall * 100).toFixed(1)}%`);
  log(`Flexible F1 Score:   ${(f1 * 100).toFixed(1)}%`);
  log(`False positive rate: ${(falsePositiveRate * 100).toFixed(1)}%`);
  log(`False negative rate: ${(falseNegativeRate * 100).toFixed(1)}%`);

  log();
  log("PER-CLASS METRICS:");
  for (const [cls, counts] of Object.entries(classCounts)) {
    const classPrecision = counts.tp + counts.fp > 0 ? counts.tp / (counts.tp + counts.fp) : 0;
    const classRecall = counts.tp + counts.fn > 0 ? counts.tp / (counts.tp + counts.fn) : 0;
    const classF1 =
      classPrecision + classRecall > 0
        ? (2 * classPrecision * classRecall) / (classPrecision + classRecall)
        : 0;
    log(
      `  ${cls.padEnd(20)} P: ${(classPrecision * 100).toFixed(0)}% | R: ${(classRecall * 100).toFixed(
        0
      )}% | F1: ${(classF1 * 100).toFixed(0)}% | TP:${counts.tp} FP:${counts.fp} FN:${counts.fn}`
    );
  }

  log();
  log("PER-SPECIALTY METRICS:");
  const specialtyMap = new Map<string, { tp: number; fp: number; fn: number; notes: number }>();
  for (const result of results) {
    const current = specialtyMap.get(result.specialty) ?? { tp: 0, fp: 0, fn: 0, notes: 0 };
    current.tp += result.truePositives;
    current.fp += result.falsePositives;
    current.fn += result.falseNegatives;
    current.notes++;
    specialtyMap.set(result.specialty, current);
  }
  for (const [specialty, counts] of specialtyMap) {
    const specialtyPrecision = counts.tp + counts.fp > 0 ? counts.tp / (counts.tp + counts.fp) : 0;
    const specialtyRecall = counts.tp + counts.fn > 0 ? counts.tp / (counts.tp + counts.fn) : 0;
    const specialtyF1 =
      specialtyPrecision + specialtyRecall > 0
        ? (2 * specialtyPrecision * specialtyRecall) / (specialtyPrecision + specialtyRecall)
        : 0;
    log(
      `  ${specialty.padEnd(22)} F1: ${(specialtyF1 * 100).toFixed(0)}% | P: ${(
        specialtyPrecision * 100
      ).toFixed(0)}% | R: ${(specialtyRecall * 100).toFixed(0)}% | Notes: ${counts.notes}`
    );
  }

  log();
  log("=".repeat(70));
  writeFileSync("validation-results.txt", `${lines.join("\n")}\n`, "utf-8");
  log("Saved report to validation-results.txt");
}

runValidation().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
