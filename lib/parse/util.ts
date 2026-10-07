export const MONTHS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];

let counter = 0;
/** Short, unique-enough ids for draft items (only need to be unique within one draft). */
export function itemId(prefix: string): string {
  counter = (counter + 1) % 1_000_000;
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function capitalize(s: string): string {
  const t = s.trim();
  return t ? t[0].toUpperCase() + t.slice(1) : t;
}

export function stripTrailingPunct(s: string): string {
  return s.replace(/[\s.;,:]+$/, "").trim();
}

export function cleanItem(s: string): string {
  return capitalize(stripTrailingPunct(s.replace(/^\s*(?:and|or)\s+/i, "")));
}

/** Split on a separator only at the top level (not inside parentheses). */
export function splitTopLevel(s: string, sep: RegExp): string[] {
  const parts: string[] = [];
  let depth = 0;
  let buf = "";
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (ch === "(" || ch === "[") depth++;
    if ((ch === ")" || ch === "]") && depth > 0) depth--;
    if (depth === 0) {
      const m = sep.exec(s.slice(i));
      if (m && m.index === 0) {
        parts.push(buf);
        buf = "";
        i += m[0].length;
        continue;
      }
    }
    buf += ch;
    i++;
  }
  parts.push(buf);
  return parts.map((p) => p.trim()).filter(Boolean);
}

/** Parse a date string into ISO yyyy-mm-dd. Returns undefined when not a plausible date. */
export function toIsoDate(s: string): string | undefined {
  let m = /\b(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\b/.exec(s);
  if (m) {
    const mo = +m[1];
    const d = +m[2];
    let y = +m[3];
    if (y < 100) y += 2000;
    return valid(y, mo, d);
  }
  m = /\b(\d{4})-(\d{2})-(\d{2})\b/.exec(s);
  if (m) return valid(+m[1], +m[2], +m[3]);
  m = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})\b/i.exec(s);
  if (m) {
    const mo = MONTHS.findIndex((x) => x.startsWith(m![1].toLowerCase().slice(0, 3))) + 1;
    return valid(+m[3], mo, +m[2]);
  }
  return undefined;
}

function valid(y: number, mo: number, d: number): string | undefined {
  if (y < 1990 || y > 2100 || mo < 1 || mo > 12 || d < 1 || d > 31) return undefined;
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export const DATE_RE =
  /\b(?:\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}-\d{2}-\d{2}|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4})\b/i;

export function wordCount(s: string): number {
  return s.trim() ? s.trim().split(/\s+/).length : 0;
}

export function firstWords(s: string, n: number): string {
  const words = s.trim().split(/\s+/);
  if (words.length <= n) return s.trim();
  return words.slice(0, n).join(" ").replace(/[,;:]$/, "") + "…";
}
