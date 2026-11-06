/**
 * Step 1: normalize raw text (pasted, PDF text layer or OCR) into clean lines.
 * Removes page furniture from multi-page text (see pages.ts), collapses whitespace,
 * fixes common OCR artifacts in doses, strips bullets and stray table borders, and joins
 * lines that wrap mid-sentence, including across a page break.
 */
import { PAGE_BREAK, stripPageFurniture } from "./pages";

const BULLET_RE = /^\s*(?:[-–—•*·▪●◦‣○□■➢►>]+|\(?\d{1,2}[.)]|\(?[a-hA-H][.)](?=\s))\s*/;
const DOSE_UNIT = String.raw`(?:mg|mcg|µg|ml|mL|units?|tabs?|tablets?|capsules?|puffs?|drops?|g|IU|iu)\b`;
/** A number as OCR reads it: at least one real digit, with l/I/O standing in for 1/0. */
const OCR_NUMBER = String.raw`(?:[0-9lIO]*[0-9][0-9lIO]*|[lI][0-9O]+)`;

/** Units as OCR misreads them, only ever fixed right after a number. */
const OCR_UNITS: [RegExp, string][] = [
  [/^(?:rng|rnq|mq)$/, "mg"],
  [/^(?:rncg|rnicg|rneg|mcq|meg)$/, "mcg"],
  [/^rnl$/, "ml"],
  [/^rnL$/, "mL"],
  [/^(?:lU|1U)$/, "IU"],
  [/^(?:rnEq|rneq)$/, "mEq"],
];
const OCR_UNIT_RE = new RegExp(String.raw`\b(${OCR_NUMBER})(\s?)(rng|rnq|mq|rncg|rnicg|rneg|mcq|meg|rnl|rnL|lU|1U|rnEq|rneq)\b`, "g");

/**
 * OCR misreads inside doses only: "10 rng" -> "10 mg", "5O rncg" -> "50 mcg", "l0 mg" -> "10 mg",
 * "2O mg" -> "20 mg". Numbers and words elsewhere are left alone.
 */
export function fixOcrDigits(line: string): string {
  return line
    .replace(OCR_UNIT_RE, (_m, num: string, sp: string, unit: string) => {
      const fixed = OCR_UNITS.find(([re]) => re.test(unit))?.[1] ?? unit;
      return `${num}${sp}${fixed}`;
    })
    .replace(new RegExp(String.raw`\b(${OCR_NUMBER})(\s?${DOSE_UNIT})`, "g"), (_m, num: string, unit: string) => {
      return num.replace(/[lI]/g, "1").replace(/O/g, "0") + unit;
    });
}

/** Table borders OCR reads as "|" at the start or end of a line. Inner pipes stay (they separate header fields). */
export function stripStrayPipes(line: string): string {
  return line.replace(/^\s*(?:[|¦]\s*)+/, "").replace(/(?:\s*[|¦])+\s*$/, "");
}

export function stripBullet(line: string): string {
  return line.replace(BULLET_RE, "");
}

/** ALL CAPS lines and Epic-style medication group headings never absorb the next line. */
function looksLikeHeadingLine(s: string): boolean {
  const letters = s.replace(/[^A-Za-z]/g, "");
  if (letters.length >= 3 && letters === letters.toUpperCase()) return true;
  return isMedGroupHeading(s);
}

/** Epic: "START taking these medications", "CHANGE how you take these medications", ... */
export const MED_GROUP_HEADING_RE =
  /^(?:START|STOP|CHANGE|CONTINUE|TAKE|ASK)\b[a-z ]{0,30}\b(?:these|how you take)\b[A-Za-z ,']*$/;
/** Hospital discharge lists: "NEW medications - START taking these", "STOPPED medications - do NOT take these". */
export const MED_GROUP_HEADING_ALT_RE = /^(?:NEW|CHANGED|STOPPED|CONTINUED?|HOLD)\s+(?:home\s+|current\s+)?medications?\b[^.\d]{0,50}$/;

export function isMedGroupHeading(s: string): boolean {
  return MED_GROUP_HEADING_RE.test(s) || MED_GROUP_HEADING_ALT_RE.test(s);
}

export interface NormalizedLine {
  text: string;
  /** True when this line follows a blank line (paragraph start). */
  paragraphStart: boolean;
}

/**
 * Lowercase words that cannot end a sentence: a line ending in one continues on the next.
 * Case-sensitive on purpose, so "vitamin A" or "Hepatitis B" never pull up the next line.
 */
const SOFT_END_RE = /(?:\b(?:a|an|the|and|or|of|to|for|with|on|at|by|in|from|your|if|than|before|after|about|into|per)|,)$/;
/** Second halves that keep their hyphen when a word is split across lines: "follow-" + "up". */
const KEEP_HYPHEN_RE = /^(?:up|ups|in|out|term|based|related|free|care|day|time|up\b)/i;

/** Epic medication lines start lowercase: "albuterol 90 mcg/actuation inhaler". */
const MED_LINE_START_RE = /^[a-z][A-Za-z-]{2,}(?:\s+[A-Za-z-]+){0,2}\s+\d[\d.,]*\s?(?:mg|mcg|g|ml|mL|units?|%|meq|mEq)\b/;
/** A sig line: "Inhale 2 puffs every 4 hours as needed". */
const SIG_RE = /\b(?:by mouth|tablets?|capsules?|puffs?|daily|as needed|times a day|every \d+ hours|at bedtime)\b/i;

/** True when `line` continues the sentence `prev` was cut off in. */
function continues(prev: string, line: string): boolean {
  // A sig line without a final period, then the next medication: two lines, not one.
  if (MED_LINE_START_RE.test(line) && SIG_RE.test(prev)) return false;
  if (/^[a-z(]/.test(line) && !/[.!?:]$/.test(prev)) return true;
  // "Follow up with Dr. Natarajan on" + "11/20/2026 at 10:30 AM."
  return SOFT_END_RE.test(prev) && /^[A-Za-z0-9]/.test(line) && !/^[A-Z][A-Za-z /&]{1,30}:/.test(line) && !looksLikeHeadingLine(line);
}

/**
 * True when most lines on a page are followed by exactly one blank line, the shape
 * tesseract gives for a photographed page. Needs a handful of gaps to judge.
 */
function isDoubleSpaced(lines: string[], isBlank: (l: string) => boolean): boolean {
  let gaps = 0;
  let single = 0;
  let run = -1; // -1 until the first non-blank line
  for (const l of lines) {
    if (isBlank(l)) {
      if (run >= 0) run++;
      continue;
    }
    if (run >= 0) {
      gaps++;
      if (run === 1) single++;
    }
    run = 0;
  }
  return gaps >= 4 && single / gaps >= 0.6;
}

export function normalize(raw: string): NormalizedLine[] {
  const cleaned = raw
    .replace(/\r\n?/g, "\n")
    .replace(/[  -​  　\t]/g, " ")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/ﬁ/g, "fi")
    .replace(/ﬂ/g, "fl");
  const text = stripPageFurniture(cleaned).text;

  const isBlank = (l: string) => !l.trim() || /^[-_=*.·•|¦\s]+$/.test(l.trim());
  const pageDoubleSpaced = text.split(`\n${PAGE_BREAK}\n`).map((page) => isDoubleSpaced(page.split("\n"), isBlank));

  const out: NormalizedLine[] = [];
  let page = 0;
  let blankRun = 0;
  let pageBreak = false;
  for (const rawLine of text.split("\n")) {
    if (rawLine === PAGE_BREAK) {
      pageBreak = true;
      page++;
      continue;
    }
    const unpiped = stripStrayPipes(rawLine);
    const hadBullet = BULLET_RE.test(unpiped) && unpiped.trim().length > 1;
    let line = stripBullet(unpiped).replace(/\s+/g, " ").trim();
    line = fixOcrDigits(line).replace(/(^|[.!?]\s+)l([ft])\b/g, (_m, pre: string, c: string) => `${pre}I${c}`).replace(/\blf\b/g, "if");
    if (!line || /^[-_=*.·•|\s]+$/.test(line)) {
      blankRun++;
      continue;
    }
    // What separates this line from the previous one: nothing, a blank line, or a page break.
    // On a double-spaced page (browser OCR puts a blank line after almost every line) one blank
    // line is an ordinary line break and only two or more end a paragraph.
    const softBlank = blankRun === 1 && pageDoubleSpaced[page];
    const gap: "none" | "blank" | "page" =
      out.length === 0 || (blankRun > 0 && !softBlank) ? "blank" : pageBreak ? "page" : "none";
    blankRun = 0;
    pageBreak = false;

    const prev = out[out.length - 1];
    // Join a line that wraps mid-sentence (also across a page break, never across a blank line).
    if (prev && gap !== "blank" && !hadBullet && !looksLikeHeadingLine(prev.text) && continues(prev.text, line)) {
      // Mid-word hyphenation: "medi-" + "cation", but "follow-" + "up" keeps its hyphen.
      if (/[a-z]-$/.test(prev.text) && /^[a-z]/.test(line)) {
        prev.text = KEEP_HYPHEN_RE.test(line) ? prev.text + line : prev.text.slice(0, -1) + line;
      } else prev.text = `${prev.text} ${line}`;
      continue;
    }
    out.push({ text: line, paragraphStart: gap !== "none" });
  }
  return out;
}
