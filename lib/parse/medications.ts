/**
 * Step 4: medication classifier. A line with a dose pattern, or any line inside a
 * Medications section. Kind comes from the first verb; detail is the rest of the line
 * with sig abbreviations expanded to plain words.
 */
import type { MedicationChange } from "../schema";
import { capitalize, itemId, stripTrailingPunct } from "./util";

export const DOSE_RE =
  /\b\d+(?:[.,]\d+)?\s?(?:-\s?\d+(?:\.\d+)?\s?)?(?:mg|mcg|µg|micrograms?|milligrams?|g|grams?|ml|mL|units?|tablets?|tabs?|capsules?|caps?|puffs?|drops?|sprays?|patch(?:es)?|meq|mEq|iu|IU|%)(?=\b|\s|$|[.,;)/])/i;

type Kind = MedicationChange["kind"];

const VERBS: { kind: Kind; re: RegExp }[] = [
  { kind: "stopped", re: /\b(stop(?:ped)?|discontinue[ds]?|hold|quit|do not (?:take|use)|no longer take)\b/i },
  { kind: "dose_changed", re: /\b(increase[ds]?|decrease[ds]?|change[ds]?|adjust(?:ed)?|raise[ds]?|lower(?:ed)?|reduce[ds]?|double[ds]?|cut back)\b/i },
  { kind: "continue", re: /\b(continue[ds]?|keep taking|no change|unchanged|same dose|still take)\b/i },
  { kind: "new", re: /\b(start(?:ed|ing)?|begin|new|add(?:ed)?|prescribed|resume[ds]?)\b/i },
];

/** The kind implied by the earliest medication verb in the line. */
export function medVerbKind(line: string): Kind | undefined {
  let best: { kind: Kind; idx: number } | undefined;
  for (const v of VERBS) {
    const m = v.re.exec(line);
    if (m && (best === undefined || m.index < best.idx)) best = { kind: v.kind, idx: m.index };
  }
  return best?.kind;
}

const LEAD_VERB_RE =
  /^(?:(?:please|then|also)\s+)?(?:start(?:ing)?(?:\s+taking)?|begin(?:\s+taking)?|new|add(?:ed)?|stop(?:ped)?(?:\s+taking)?|discontinue[ds]?|hold|quit(?:\s+taking)?|do not (?:take|use)|increase[ds]?|decrease[ds]?|change[ds]?|adjust(?:ed)?|raise|lower|reduce[ds]?|continue(?:\s+taking)?|keep taking|resume|take|taking|use|prescribed)\b[\s:,-]*(?:your\s+|the\s+|a\s+)?/i;

const NOT_A_NAME = new Set([
  "to", "by", "from", "at", "the", "your", "dose", "doses", "of", "a", "an", "and", "or", "with", "for", "in",
  "tablet", "tablets", "tab", "tabs", "capsule", "capsules", "medication", "medicine", "medications", "pill", "pills",
  "taking", "take", "daily", "once", "twice", "each", "every", "per", "as", "this", "that", "it", "them", "all",
  "until", "unless", "instructed", "do", "not", "no", "change", "mouth", "by", "total", "one", "two", "half",
]);

const ABBREVIATIONS: [RegExp, string][] = [
  [/\bq\.?\s?(\d+)\s?h(?:rs?|ours?)?\b/gi, "every $1 hours"],
  [/\bb\.?i\.?d\.?(?=\s|$|[,;)])/gi, "twice a day"],
  [/\bt\.?i\.?d\.?(?=\s|$|[,;)])/gi, "three times a day"],
  [/\bq\.?i\.?d\.?(?=\s|$|[,;)])/gi, "four times a day"],
  [/\bq\.?h\.?s\.?(?=\s|$|[,;)])/gi, "at bedtime"],
  [/\bq\.?a\.?m\.?(?=\s|$|[,;)])/gi, "every morning"],
  [/\bq\.?p\.?m\.?(?=\s|$|[,;)])/gi, "every evening"],
  [/\bq\.?d\.?(?=\s|$|[,;)])/gi, "once a day"],
  [/\bq\.?o\.?d\.?(?=\s|$|[,;)])/gi, "every other day"],
  [/\bp\.?r\.?n\.?(?=\s|$|[,;)])/gi, "as needed"],
  [/\bp\.?o\.?(?=\s|$|[,;)])/g, "by mouth"],
  [/\bPO\b/g, "by mouth"],
  [/\bh\.?s\.?(?=\s|$|[,;)])/g, "at bedtime"],
  [/\bSL\b/g, "under the tongue"],
  [/\bw\/\s?/gi, "with "],
  [/\bw\/o\b/gi, "without"],
];

export function expandAbbreviations(s: string): string {
  let out = s;
  for (const [re, rep] of ABBREVIATIONS) out = out.replace(re, rep);
  return out.replace(/\s+/g, " ").trim();
}

function titleCaseName(words: string[]): string {
  return words
    .map((w) => {
      // Keep tall-man lettering and brand capitals readable: metFORMIN -> Metformin
      const lower = w.toLowerCase();
      return lower[0].toUpperCase() + lower.slice(1);
    })
    .join(" ");
}

/** Extract the medication name: the word(s) right after the leading verb, before the dose. */
export function extractName(line: string): { name: string; end: number } | null {
  const lead = LEAD_VERB_RE.exec(line);
  const start = lead ? lead[0].length : 0;
  const rest = line.slice(start);
  const tokens = rest.split(/(\s+)/);
  const words: string[] = [];
  let consumed = start;
  for (const tok of tokens) {
    if (/^\s+$/.test(tok)) {
      if (words.length) consumed += tok.length;
      else consumed += tok.length;
      continue;
    }
    const clean = tok.replace(/[(),.;:]+$/, "").replace(/^[("]+/, "");
    if (!/^[A-Za-z][A-Za-z0-9'-]*[A-Za-z0-9]$/.test(clean)) break;
    if (NOT_A_NAME.has(clean.toLowerCase())) break;
    words.push(clean);
    consumed += tok.length;
    if (words.length >= 3 || /[,;:)]$/.test(tok)) break;
  }
  if (!words.length) return null;
  return { name: titleCaseName(words), end: consumed };
}

function extractReason(line: string): string | undefined {
  const m = /\b(?:for|to treat|to help with|to help)\s+(?:your\s+|the\s+)?([a-z][a-z' -]{2,40}?)\s*(?:[.;,)]|$)/i.exec(line);
  if (!m) return undefined;
  const r = m[1].trim();
  if (/^(\d|now|a while|the next|next|days?|weeks?|months?|life|ever|one|two|three|a few)\b/i.test(r)) return undefined;
  if (/\b(days?|weeks?|months?)\b/i.test(r)) return undefined;
  return capitalize(r);
}

const DEFAULT_DETAIL: Record<Kind, string> = {
  new: "New medicine",
  stopped: "Stop taking",
  dose_changed: "Dose changed",
  continue: "No change",
};

export interface MedClassification {
  med: MedicationChange;
  /** True when the line had no name and should be appended to the previous medication instead. */
  continuation?: false;
}

/**
 * Try to read a medication from one line.
 * @param inMedSection the line sits under a Medications heading
 * @param kindHint e.g. "stopped" from "STOP taking these medications"
 */
export function classifyMedication(
  line: string,
  inMedSection: boolean,
  kindHint?: Kind,
): MedicationChange | null {
  const dose = DOSE_RE.exec(line);
  const verbKind = medVerbKind(line);
  if (!dose && !inMedSection) return null;

  const named = extractName(line);
  if (!named) return null;

  const kind: Kind = verbKind ?? kindHint ?? "continue";
  let detailSrc: string;
  if (dose) detailSrc = line.slice(dose.index);
  else detailSrc = line.slice(named.end).replace(/^\s*(?:to|by|from)\s+/i, "");
  let detail = stripTrailingPunct(expandAbbreviations(detailSrc)).replace(/(\d)\s?(MG|MCG|ML)\b/g, (_m, n: string, u: string) => `${n} ${u.toLowerCase()}`);
  if (!detail) detail = DEFAULT_DETAIL[kind];

  const hasVerb = verbKind !== undefined || kindHint !== undefined;
  return {
    id: itemId("med"),
    kind,
    name: named.name,
    detail: capitalize(detail),
    reason: extractReason(line),
    confidence: hasVerb && (dose || kind === "stopped") ? "high" : "low",
  };
}
