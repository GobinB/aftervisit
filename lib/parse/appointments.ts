/**
 * Step 5b: scheduled appointments. Epic and hospital summaries list upcoming visits as
 * small blocks of short lines (date and time, provider, location) rather than sentences.
 * Each block becomes one "appointment" task, with dueDate / dueTime when the block states
 * an explicit calendar date. All lines of the block are placed in the task bucket.
 */
import type { Task } from "../schema";
import { findExplicitDate, findTime, isoForMatch } from "./dates";
import { DR_NAME_RE, PROVIDER_CRED_RE, formatProvider, isIdentifierLine } from "./header";
import { headingOf } from "./sections";
import { TIMING_RE, isImperative } from "./tasks";
import { itemId, wordCount } from "./util";

/** Section headings that list scheduled visits. */
export const APPOINTMENT_HEADING_RE = /\b(?:appointments?|follow[- ]?ups?|next visits?|scheduled visits?|future visits?)\b/i;
/** Inline labels that introduce one: "Your next appointment: Tuesday, December 1 ..." */
export const APPOINTMENT_LABEL_RE = /\b(?:appointments?|next visit|follow[- ]?up visit|return visit)\b/i;

const FIELD_LABEL_RE = /^(?:date|time|when|where|location|department|provider|with|clinic|address|arrive by|arrival time|appt|appointment)\s*:/i;
const LOCATION_RE = /\b(?:clinic|center|centre|hospital|suite|floor|building|office|pavilion|tower|room|wing|lab|laboratory|imaging|practice|medical group)\b/i;
/** Generic words lowercased inside a title: "Follow-up Visit" -> "Follow-up visit". */
const GENERIC_WORDS_RE = /\b(Visit|Appointment|Exam|Check|Consult|Consultation|Session|Test|Draw)\b/g;
const VISIT_WORDS_RE = /\b(?:visit|appointment|exam|check|consult|consultation|session|test|scan|draw|lab|x-?ray|mri|ultrasound|echo(?:cardiogram)?|therapy)\b/i;

function hasProvider(line: string): boolean {
  return PROVIDER_CRED_RE.test(line) || DR_NAME_RE.test(line) || /^(?:provider|with)\s*:/i.test(line);
}

/**
 * Group lines under appointment headings into one entry per appointment. An entry is a run
 * of short, non-sentence lines; a new one starts at a blank line, or when a second date,
 * time or provider shows up. Sentences ("Follow up with your doctor within 7 days.") are
 * left for the ordinary task classifier. Returns the line indexes of each entry.
 */
export function findAppointmentEntries(lines: string[], paragraphStart: boolean[]): number[][] {
  const entries: number[][] = [];
  let inSection = false;
  let cur: { idx: number[]; date: boolean; time: boolean; provider: boolean } | null = null;
  const close = () => {
    if (cur && (cur.date || cur.provider)) entries.push(cur.idx);
    cur = null;
  };

  lines.forEach((line, i) => {
    const date = findExplicitDate(line) !== null;
    const provider = hasProvider(line);
    if (!(inSection && (date || provider))) {
      const heading = headingOf(line);
      if (heading) {
        close();
        inSection = heading.kind === "tasks" && APPOINTMENT_HEADING_RE.test(line);
        return;
      }
    }
    if (!inSection) return;
    if (paragraphStart[i]) close();
    // Phone numbers and other identifier lines stay with the header parser; they do not end the entry.
    if (isIdentifierLine(line)) return;
    if (/[.!?]$/.test(line)) {
      close();
      return;
    }
    const time = findTime(line) !== null;
    const labelled = FIELD_LABEL_RE.test(line);
    const short = wordCount(line) <= 6 && !isImperative(line);
    if (!date && !time && !provider && !labelled && !short) {
      close();
      return;
    }
    // A provider line followed straight by a date line opens the next entry (provider-first layout).
    const leadsNext =
      provider && !date && i + 1 < lines.length && !paragraphStart[i + 1] && findExplicitDate(lines[i + 1]) !== null && !hasProvider(lines[i + 1]);
    // A second date, time or provider means the next appointment has begun, blank line or not.
    if (cur && ((date && cur.date) || (time && cur.time) || (provider && cur.provider) || (leadsNext && cur.date))) close();
    if (!cur) cur = { idx: [], date: false, time: false, provider: false };
    cur.idx.push(i);
    cur.date ||= date;
    cur.time ||= time;
    cur.provider ||= provider;
  });
  close();
  return entries;
}

/** A named place: "Maplewood Heart Center, Suite 210", not "Lab draw". */
function looksLikePlace(seg: string): boolean {
  return LOCATION_RE.test(seg) && seg.split(/\s+/).every((w) => w.length <= 3 || /^[A-Z0-9(#]/.test(w));
}

function providerOf(segment: string): { provider: string; before: string } | null {
  const labelled = /^(?:provider|with)\s*:\s*(.+)$/i.exec(segment);
  const s = labelled ? labelled[1] : segment;
  const cred = PROVIDER_CRED_RE.exec(s);
  if (cred) return { provider: formatProvider(cred[1], cred[2]), before: s.slice(0, cred.index) };
  const dr = DR_NAME_RE.exec(s);
  if (dr) return { provider: `Dr. ${dr[1]}`, before: s.slice(0, dr.index) };
  if (labelled) return { provider: labelled[1].trim(), before: "" };
  return null;
}

function tidy(s: string): string {
  return s
    .replace(/^[\s,;:@–—-]+|[\s,;:@–—-]+$/g, "")
    .replace(/^(?:(?:at|on|with|for)\b\s*)+/i, "")
    .replace(/(?:\s*\b(?:at|on|with|for))+$/i, "")
    .trim();
}

/** Lift dates, times and timing phrases out of a line, leaving the descriptive pieces. */
function segmentsOf(part: string): string[] {
  let s = part;
  for (let m = findExplicitDate(s); m; m = findExplicitDate(s)) s = `${s.slice(0, m.index)} | ${s.slice(m.end)}`;
  for (let t = findTime(s); t; t = findTime(s)) s = `${s.slice(0, t.index)} | ${s.slice(t.end)}`;
  s = s.replace(TIMING_RE, " | ").replace(/\b(?:date|time|when|appt|appointment(?: date)?)\s*:/gi, " | ");
  return s
    .split(/\s*\|\s*|\s+[–—-]\s+|\s{2,}/)
    .map(tidy)
    .filter((x) => /[A-Za-z]{2}/.test(x));
}

function sentenceCase(s: string): string {
  const t = s.replace(GENERIC_WORDS_RE, (w) => w.toLowerCase());
  return t[0].toUpperCase() + t.slice(1);
}

/**
 * Build one appointment task from the lines of an entry (or the content of an inline
 * "Next appointment:" line). Returns null when there is neither a date nor a provider.
 */
export function appointmentTask(parts: string[], visitDate?: string, sourceQuote?: string): Task | null {
  const text = parts.join(" ");
  const dateMatch = findExplicitDate(text);
  const timing = dateMatch ? null : TIMING_RE.exec(text);

  let type: string | undefined;
  let provider: string | undefined;
  let location: string | undefined;
  for (const raw of parts) {
    // "Your next appointment: ..." -> the label says nothing the title will not.
    const label = /^([A-Za-z' -]{0,40}):\s*(\S.*)$/.exec(raw);
    const part = label && APPOINTMENT_LABEL_RE.test(label[1]) ? label[2] : raw;
    const loc = /^(?:location|where|clinic|address)\s*:\s*(.+)$/i.exec(part);
    if (loc) {
      location ??= tidy(loc[1]);
      continue;
    }
    const dept = /^department\s*:\s*(.+)$/i.exec(part);
    if (dept) {
      type ??= tidy(dept[1]);
      continue;
    }
    for (const seg of segmentsOf(part)) {
      const p = providerOf(seg);
      if (p) {
        provider ??= p.provider;
        const before = tidy(p.before);
        if (before && wordCount(before) <= 4) type ??= before;
      } else if (looksLikePlace(seg)) location ??= seg;
      else if (wordCount(seg) <= 5 && !isImperative(seg)) type ??= seg;
    }
  }
  if (!dateMatch && !provider) return null;

  let dueText: string | undefined;
  let dueDate: string | undefined;
  let dueTime: string | undefined;
  if (dateMatch) {
    dueText = text.slice(dateMatch.index, dateMatch.end).trim();
    dueDate = isoForMatch(dateMatch, visitDate) ?? undefined;
    const rest = text.slice(0, dateMatch.index) + " ".repeat(dateMatch.end - dateMatch.index) + text.slice(dateMatch.end);
    const time = findTime(rest);
    if (time) {
      dueText = `${dueText} at ${rest.slice(time.index, time.end).trim()}`;
      if (dueDate) dueTime = time.time;
    }
  } else if (timing) {
    dueText = timing[0].trim().toLowerCase();
  }

  let title = type ? sentenceCase(type) : "Appointment";
  if (type && !VISIT_WORDS_RE.test(type)) title += " appointment";
  if (provider) title += ` with ${provider}`;
  if (location && location.length <= 40) title += ` at ${location}`;

  return {
    id: itemId("task"),
    title,
    category: "appointment",
    dueText,
    ...(dueDate ? { dueDate } : {}),
    ...(dueTime ? { dueTime } : {}),
    sourceQuote: (sourceQuote ?? text).trim() || undefined,
    confidence: dateMatch ? "high" : "low",
  };
}
