/**
 * Scores a draft against a case's right answers: medicines, doses, dates and next steps.
 * Plain functions, no network. Used by the accuracy run (eval/accuracy.eval.ts) and by CI.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { HandoffDraft, MedicationChange } from "@/lib/schema";

export interface ExpectedMed {
  name: string;
  aliases?: string[];
  /** The change; a list when the page does not say (a label: new or continued). */
  kind: MedicationChange["kind"] | MedicationChange["kind"][];
  dose?: string;
  /** The dose cannot be read on the page: the reader must leave it blank and flag the medicine. */
  unreadableDose?: boolean;
  /** Not counted against the reader if missed, nor as an extra if found. */
  optional?: boolean;
}

export interface ExpectedStep {
  what: string;
  /** Regular expressions (case-insensitive) that must all match the step's title and timing. */
  match: string[];
  date?: string;
  optional?: boolean;
}

export interface Answers {
  format: string;
  visitDate: string | null;
  /** Dates printed on the page that are fine to report (the date a label was filled), but not required. */
  alsoAcceptDates?: string[];
  medications: ExpectedMed[];
  nextSteps: ExpectedStep[];
}

export interface Case {
  id: string;
  answers: Answers;
  /** Text of each page. */
  pages: string[];
  /** Paths of the photographed pages, in order (empty if none were made). */
  photos: string[];
}

/** found: right answers the reader got. expected: right answers there were. extra: things it made up or got wrong. */
export interface Tally {
  found: number;
  expected: number;
  extra: number;
}

export interface CaseScore {
  medicines: Tally;
  doses: Tally;
  dates: Tally;
  nextSteps: Tally;
  /** Unreadable doses left blank and flagged (found), or guessed (extra). */
  noGuess: Tally;
  /** Medicines marked "Please check this". */
  flagged: number;
}

export const METRICS = ["medicines", "doses", "dates", "nextSteps", "noGuess"] as const;
export type Metric = (typeof METRICS)[number];

const letters = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");
const doseKey = (s: string) =>
  s
    .toLowerCase()
    .replace(/milligrams?/g, "mg")
    .replace(/micrograms?/g, "mcg")
    .replace(/[\s,]/g, "");

/** A drug name matches when one contains the other, ignoring case, spaces and punctuation. */
export function nameMatches(expected: ExpectedMed, got: string): boolean {
  const g = letters(got);
  if (!g) return false;
  return [expected.name, ...(expected.aliases ?? [])].some((n) => {
    const e = letters(n);
    return g.includes(e) || e.includes(g);
  });
}

const kindOk = (e: ExpectedMed, got: MedicationChange["kind"]) => (Array.isArray(e.kind) ? e.kind.includes(got) : e.kind === got);

/** Pairs each expected item with at most one drafted item, in order. Returns, per expected item, the index it got. */
function pair<E, G>(expected: E[], got: G[], matches: (e: E, g: G) => boolean): (number | null)[] {
  const used = new Set<number>();
  return expected.map((e) => {
    const i = got.findIndex((g, j) => !used.has(j) && matches(e, g));
    if (i < 0) return null;
    used.add(i);
    return i;
  });
}

export function scoreCase(answers: Answers, draft: HandoffDraft): CaseScore {
  // Medicines: right name and right change (new, stopped, changed, continued).
  const medPairs = pair(answers.medications, draft.medications, (e, g) => nameMatches(e, g.name || g.sourceQuote || ""));
  const medFound = answers.medications.filter((e, i) => !e.optional && medPairs[i] !== null && kindOk(e, draft.medications[medPairs[i]!].kind)).length;
  const medExpected = answers.medications.filter((e) => !e.optional).length;
  const pairedMeds = new Set(medPairs.filter((i): i is number => i !== null));
  const medExtra =
    draft.medications.filter((_, j) => !pairedMeds.has(j)).length +
    answers.medications.filter((e, i) => !e.optional && medPairs[i] !== null && !kindOk(e, draft.medications[medPairs[i]!].kind)).length;

  // Doses: for each medicine with a stated dose, the paired item states that dose.
  const withDose = answers.medications.map((e, i) => ({ e, i })).filter(({ e }) => e.dose && !e.optional);
  const doseFound = withDose.filter(({ e, i }) => {
    const j = medPairs[i];
    if (j === null) return false;
    const m = draft.medications[j];
    return doseKey(`${m.name} ${m.detail}`).includes(doseKey(e.dose!));
  }).length;
  const doseExtra = withDose.filter(({ e, i }) => {
    const j = medPairs[i];
    return j !== null && draft.medications[j].detail.trim() !== "" && !doseKey(`${draft.medications[j].name} ${draft.medications[j].detail}`).includes(doseKey(e.dose!));
  }).length;

  // Unreadable doses: the paired medicine is flagged and states no dose.
  const blurred = answers.medications.map((e, i) => ({ e, i })).filter(({ e }) => e.unreadableDose);
  const guessed = ({ i }: { i: number }) => medPairs[i] !== null && /\d\s*(mg|mcg|g|ml|units?)\b/i.test(draft.medications[medPairs[i]!].detail);
  const noGuessFound = blurred.filter((b) => medPairs[b.i] !== null && !guessed(b) && draft.medications[medPairs[b.i]!].confidence === "low").length;

  // Dates: the visit date and every stated appointment or due date.
  const want = new Set([answers.visitDate, ...answers.nextSteps.filter((s) => !s.optional).map((s) => s.date)].filter((d): d is string => !!d));
  const okay = new Set([...want, ...(answers.alsoAcceptDates ?? []), ...answers.nextSteps.map((s) => s.date).filter((d): d is string => !!d)]);
  const got = new Set([draft.visit.date, ...draft.tasks.map((t) => t.dueDate)].filter((d): d is string => !!d));
  const dateFound = [...want].filter((d) => got.has(d)).length;
  const dateExtra = [...got].filter((d) => !okay.has(d)).length;

  // Next steps: each expected step is matched by one drafted to-do.
  const stepText = (t: HandoffDraft["tasks"][number]) => `${t.title} ${t.dueText ?? ""}`;
  const stepPairs = pair(answers.nextSteps, draft.tasks, (e, g) => e.match.every((re) => new RegExp(re, "i").test(stepText(g))));
  const stepFound = answers.nextSteps.filter((e, i) => !e.optional && stepPairs[i] !== null).length;
  const pairedSteps = new Set(stepPairs.filter((i): i is number => i !== null));
  const stepExtra = draft.tasks.filter((_, j) => !pairedSteps.has(j)).length;

  return {
    medicines: { found: medFound, expected: medExpected, extra: medExtra },
    doses: { found: doseFound, expected: withDose.length, extra: doseExtra },
    dates: { found: dateFound, expected: want.size, extra: dateExtra },
    nextSteps: { found: stepFound, expected: answers.nextSteps.filter((s) => !s.optional).length, extra: stepExtra },
    noGuess: { found: noGuessFound, expected: blurred.length, extra: blurred.filter(guessed).length },
    flagged: draft.medications.filter((m) => m.confidence === "low").length,
  };
}

export function sumScores(scores: CaseScore[]): CaseScore {
  const zero = (): Tally => ({ found: 0, expected: 0, extra: 0 });
  const total: CaseScore = { medicines: zero(), doses: zero(), dates: zero(), nextSteps: zero(), noGuess: zero(), flagged: 0 };
  for (const s of scores) {
    for (const m of METRICS) {
      total[m].found += s[m].found;
      total[m].expected += s[m].expected;
      total[m].extra += s[m].extra;
    }
    total.flagged += s.flagged;
  }
  return total;
}

/** "11 of 12 (92%), 1 extra"; a dash when the case has none to find. */
export function describe(t: Tally): string {
  if (!t.expected && !t.extra) return "–";
  const pct = t.expected ? Math.round((100 * t.found) / t.expected) : 100;
  return `${t.found} of ${t.expected} (${pct}%)${t.extra ? `, ${t.extra} extra` : ""}`;
}

/** A markdown table: one row per case, then the total. */
export function table(rows: { label: string; score: CaseScore }[]): string {
  const head = "| Case | Medicines (name and change) | Doses | Dates | Next steps | Unreadable dose left blank | Flagged |\n|---|---|---|---|---|---|---|";
  const line = (label: string, s: CaseScore) => `| ${label} | ${METRICS.map((m) => describe(s[m])).join(" | ")} | ${s.flagged} |`;
  return [head, ...rows.map((r) => line(r.label, r.score)), line("**All cases**", sumScores(rows.map((r) => r.score)))].join("\n");
}

const METRIC_LABELS: Record<Metric, string> = {
  medicines: "Medicines (name and change)",
  doses: "Doses",
  dates: "Dates",
  nextSteps: "Next steps",
  noGuess: "Unreadable dose left blank",
};

/** One column per reader, one row per measure: the side-by-side summary. */
export function compare(readers: { reader: string; score: CaseScore }[]): string {
  const head = `| | ${readers.map((r) => r.reader).join(" | ")} |\n|---|${readers.map(() => "---").join("|")}|`;
  const rows = METRICS.map((m) => `| ${METRIC_LABELS[m]} | ${readers.map((r) => describe(r.score[m])).join(" | ")} |`);
  return [head, ...rows].join("\n");
}

export const CASES_DIR = join(import.meta.dirname, "cases");

export function loadCases(dir = CASES_DIR): Case[] {
  return readdirSync(dir)
    .sort()
    .map((id) => {
      const files = readdirSync(join(dir, id)).sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
      return {
        id,
        answers: JSON.parse(readFileSync(join(dir, id, "answers.json"), "utf8")) as Answers,
        pages: files.filter((f) => /^page-\d+\.txt$/.test(f)).map((f) => readFileSync(join(dir, id, f), "utf8")),
        photos: files.filter((f) => /^page-\d+\.jpg$/.test(f)).map((f) => join(dir, id, f)),
      };
    });
}

/** The case as text, the way a portal paste or a PDF's text arrives: pages one after another. */
export const caseText = (c: Case) => c.pages.join("\n\n").replace(/\[\[blot:.*?\]\]/g, "\u2593\u2593\u2593");
