/**
 * Due dates for tasks. Pure and deterministic: no clock, no network.
 * Explicit calendar dates ("11/20/2026", "Nov 20", "Tuesday, December 1, 2026") and
 * relative phrases ("in 2 weeks", "within 3 months") become ISO yyyy-mm-dd; an optional
 * time ("10:30 AM", "9:15am", "14:00") becomes 24-hour HH:MM.
 */
import { MONTHS } from "./util";

export interface DueDate {
  /** ISO yyyy-mm-dd */
  date: string;
  /** 24-hour HH:MM, only when the text states a time */
  time?: string;
}

/** An explicit calendar date found in text, with where it sits. */
export interface DateMatch {
  index: number;
  end: number;
  month: number;
  day: number;
  /** Missing when the source left the year out ("Nov 20"). */
  year?: number;
}

const MONTH_NAME = String.raw`(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sept|sep|oct|nov|dec)\b\.?`;
const WEEKDAY = String.raw`(?:mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)(?:day|nesday|sday|urday)?\.?,?\s+`;

const NUMERIC_RE = /\b(\d{1,2})\/(\d{1,2})\/(\d{4}|\d{2})\b|\b(\d{1,2})-(\d{1,2})-(\d{4})\b/g;
const ISO_RE = /\b(\d{4})-(\d{2})-(\d{2})\b/g;
const MONTH_DAY_RE = new RegExp(String.raw`\b(?:${WEEKDAY})?${MONTH_NAME}\s+(\d{1,2})(?:st|nd|rd|th)?\b(?!:|\d|\s*(?:mg|mcg|ml|units?)\b)(?:,?\s+(\d{4})\b)?`, "gi");
const DAY_MONTH_RE = new RegExp(String.raw`\b(?:${WEEKDAY})?(\d{1,2})(?:st|nd|rd|th)?\s+${MONTH_NAME}(?:,?\s+(\d{4})\b)?`, "gi");
/** "on 11/20" or "by 11/20": month/day without a year only after a date word, so "1/2 tablet" is never a date. */
const SHORT_NUMERIC_RE = /\b(?:on|by|before|until|due|date:?)\s+(?:(?:mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)[a-z]*\.?,?\s+)?(\d{1,2})\/(\d{1,2})\b(?!\/)/gi;

function monthIndex(name: string): number {
  return MONTHS.findIndex((m) => m.startsWith(name.toLowerCase().slice(0, 3))) + 1;
}

function daysIn(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function plausible(m: number, d: number, y?: number): boolean {
  if (m < 1 || m > 12 || d < 1) return false;
  if (y !== undefined && (y < 1990 || y > 2100)) return false;
  return d <= daysIn(y ?? 2024, m); // 2024 is a leap year, so Feb 29 is allowed when the year is unknown
}

/** The earliest explicit calendar date in the text, or null. Weekday names are kept inside the match. */
export function findExplicitDate(text: string): DateMatch | null {
  const found: DateMatch[] = [];
  const push = (index: number, len: number, month: number, day: number, year?: number) => {
    if (plausible(month, day, year)) found.push({ index, end: index + len, month, day, year });
  };
  for (const m of text.matchAll(NUMERIC_RE)) {
    if (m[1]) {
      const y = m[3].length === 2 ? 2000 + +m[3] : +m[3];
      push(m.index!, m[0].length, +m[1], +m[2], y);
    } else push(m.index!, m[0].length, +m[4], +m[5], +m[6]);
  }
  for (const m of text.matchAll(ISO_RE)) push(m.index!, m[0].length, +m[2], +m[3], +m[1]);
  for (const m of text.matchAll(MONTH_DAY_RE)) push(m.index!, m[0].length, monthIndex(m[1]), +m[2], m[3] ? +m[3] : undefined);
  for (const m of text.matchAll(DAY_MONTH_RE)) push(m.index!, m[0].length, monthIndex(m[2]), +m[1], m[3] ? +m[3] : undefined);
  for (const m of text.matchAll(SHORT_NUMERIC_RE)) {
    const start = m.index! + m[0].search(/\d/);
    push(start, m.index! + m[0].length - start, +m[1], +m[2]);
  }
  if (!found.length) return null;
  // Earliest wins; on a tie the longest (it carries the weekday or the year).
  found.sort((a, b) => a.index - b.index || b.end - a.end);
  return found[0];
}

export interface TimeMatch {
  index: number;
  end: number;
  /** 24-hour HH:MM */
  time: string;
}

const TIME_12_RE = /\b(\d{1,2})(?::([0-5]\d))?\s*([ap])\.?\s?m\b/gi;
const TIME_24_RE = /\b([01]?\d|2[0-3]):([0-5]\d)\b(?!\s*[ap]\.?\s?m\b)/gi;

/** The first clock time in the text: "10:30 AM", "9:15am", "2 PM", "14:00", "noon". */
export function findTime(text: string): TimeMatch | null {
  const found: TimeMatch[] = [];
  for (const m of text.matchAll(TIME_12_RE)) {
    let h = +m[1];
    if (h < 1 || h > 12) continue;
    const pm = m[3].toLowerCase() === "p";
    if (pm && h < 12) h += 12;
    if (!pm && h === 12) h = 0;
    found.push({ index: m.index!, end: m.index! + m[0].length, time: `${pad(h)}:${m[2] ?? "00"}` });
  }
  for (const m of text.matchAll(TIME_24_RE)) {
    found.push({ index: m.index!, end: m.index! + m[0].length, time: `${pad(+m[1])}:${m[2]}` });
  }
  const noon = /\bnoon\b/i.exec(text);
  if (noon) found.push({ index: noon.index, end: noon.index + noon[0].length, time: "12:00" });
  if (!found.length) return null;
  found.sort((a, b) => a.index - b.index);
  return found[0];
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function iso(y: number, m: number, d: number): string {
  return `${y}-${pad(m)}-${pad(d)}`;
}

function parseIso(s: string | undefined): { y: number; m: number; d: number } | null {
  const m = s ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(s) : null;
  return m ? { y: +m[1], m: +m[2], d: +m[3] } : null;
}

/**
 * ISO date for an explicit match. A missing year takes the visit year, or the next year
 * when that would fall before the visit. Without a visit date a yearless date is null.
 */
export function isoForMatch(match: DateMatch, visitDate?: string): string | null {
  if (match.year !== undefined) return iso(match.year, match.month, match.day);
  const visit = parseIso(visitDate);
  if (!visit) return null;
  let y = visit.y;
  if (iso(y, match.month, match.day) < iso(visit.y, visit.m, visit.d)) y += 1;
  if (match.day > daysIn(y, match.month)) return null;
  return iso(y, match.month, match.day);
}

const NUMBER_WORDS: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, "a couple of": 2, "a couple": 2,
};
const NUM = String.raw`(\d{1,3}|a couple of|a couple|an?|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)`;
const RELATIVE_RE = new RegExp(
  String.raw`\b(?:in|within|after)\s+(?:about\s+|approximately\s+|the\s+next\s+)?${NUM}(?:\s*(?:-|to|or)\s*(\d{1,3}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve))?\s+(days?|weeks?|wks?|months?|mos?|years?|yrs?)\b`,
  "i",
);

function toNumber(s: string): number {
  return /^\d+$/.test(s) ? +s : NUMBER_WORDS[s.toLowerCase()] ?? NaN;
}

function addDays(y: number, m: number, d: number, days: number): string {
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return iso(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

function addMonths(y: number, m: number, d: number, months: number): string {
  const total = y * 12 + (m - 1) + months;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return iso(ny, nm, Math.min(d, daysIn(ny, nm)));
}

/** Date for a relative phrase, counted from the visit date. A range ("1-2 weeks") uses its later end. */
function resolveRelative(text: string, visitDate?: string): string | null {
  const visit = parseIso(visitDate);
  if (!visit) return null;
  const m = RELATIVE_RE.exec(text);
  if (m) {
    const n = toNumber(m[2] ?? m[1]);
    if (!Number.isFinite(n) || n <= 0) return null;
    const unit = m[3].toLowerCase();
    if (unit.startsWith("d")) return addDays(visit.y, visit.m, visit.d, n);
    if (unit.startsWith("w")) return addDays(visit.y, visit.m, visit.d, n * 7);
    if (unit.startsWith("m")) return addMonths(visit.y, visit.m, visit.d, n);
    return addMonths(visit.y, visit.m, visit.d, n * 12);
  }
  if (/\btomorrow\b/i.test(text)) return addDays(visit.y, visit.m, visit.d, 1);
  if (/\bnext week\b/i.test(text)) return addDays(visit.y, visit.m, visit.d, 7);
  if (/\bnext month\b/i.test(text)) return addMonths(visit.y, visit.m, visit.d, 1);
  return null;
}

/**
 * Turn a due phrase into a date (and time when stated).
 * - Explicit dates win: "11/20/2026", "Nov 20", "December 1, 2026", "Tuesday, December 1".
 *   A missing year takes the visit year, or the next year when the date would fall before the visit.
 * - Relative phrases ("in 2 weeks", "within 3 months", "in 10 days", "tomorrow", "next week")
 *   are counted from the visit date.
 * - Returns null when nothing resolves, or when the phrase needs a visit date and none is given.
 */
export function resolveDue(text: string, visitDate?: string): DueDate | null {
  if (!text?.trim()) return null;
  const explicit = findExplicitDate(text);
  let date: string | null = null;
  if (explicit) date = isoForMatch(explicit, visitDate);
  else date = resolveRelative(text, visitDate);
  if (!date) return null;
  // Look for the time outside the date itself so "11/20/2026" never reads as a time.
  const rest = explicit ? text.slice(0, explicit.index) + " ".repeat(explicit.end - explicit.index) + text.slice(explicit.end) : text;
  const time = findTime(rest);
  return time ? { date, time: time.time } : { date };
}
