/**
 * Step 5: task classifier. Lines that begin with an imperative or contain a timing
 * phrase. Category from keywords; dueText is the captured timing phrase. One line is
 * one task, split on semicolons and " and " when both halves start with a verb.
 */
import type { Task } from "../schema";
import { capitalize, cleanItem, itemId, splitTopLevel, wordCount } from "./util";

const IMPERATIVES = [
  "call", "schedule", "bring", "pick up", "return", "get", "check", "take", "drink", "make", "complete",
  "book", "follow up", "follow-up", "see", "go", "keep", "avoid", "walk", "eat", "use", "apply", "wear",
  "rest", "weigh", "record", "monitor", "write", "elevate", "ice", "attend", "fill", "refill", "sign up",
  "arrange", "set up", "contact", "visit", "have", "obtain", "measure", "log", "limit", "increase", "do",
  "start", "stop", "remember", "please", "plan", "continue", "watch", "bring",
];
const IMPERATIVE_RE = new RegExp(
  String.raw`^(?:please\s+)?(?:${IMPERATIVES.map((v) => v.replace(/[ -]/g, "[ -]")).join("|")})\b`,
  "i",
);

const NUM = String.raw`(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten|twelve|a few|a couple of)`;
const UNIT = String.raw`(?:days?|weeks?|wks?|months?|mos?|hours?|hrs?)`;
const MONTH = String.raw`(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?`;
const DATE = String.raw`(?:\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?|${MONTH}\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s+\d{4})?)`;

export const TIMING_RE = new RegExp(
  [
    String.raw`\bwithin\s+(?:the\s+next\s+)?${NUM}(?:\s*(?:-|to)\s*${NUM})?\s+${UNIT}`,
    String.raw`\bin\s+(?:about\s+)?${NUM}(?:\s*(?:-|to)\s*${NUM})?\s+${UNIT}`,
    String.raw`\b(?:by|before|on|after)\s+${DATE}`,
    String.raw`\bbefore\s+(?:your|the)\s+next\s+(?:visit|appointment)`,
    String.raw`\b(?:at|by)\s+(?:your|the)\s+next\s+(?:visit|appointment)`,
    String.raw`\b(?:every|each)\s+(?:morning|evening|night|day|week)\b`,
    String.raw`\b(?:tomorrow|this week|next week|this month|next month)\b`,
    String.raw`\bdaily\b`,
  ].join("|"),
  "i",
);

export function isImperative(line: string): boolean {
  return IMPERATIVE_RE.test(line.trim());
}

export function hasTiming(line: string): boolean {
  return TIMING_RE.test(line);
}

export function categorize(text: string): Task["category"] {
  const t = text.toLowerCase();
  if (/\b(labs?|blood (?:test|work|draw)|bloodwork|panel|a1c|cbc|cmp|bmp|x-?ray|imaging|mri|ct scan|ultrasound|urine|culture|test(?:ing)?|ekg|ecg|echo)\b/.test(t)) return "lab";
  if (/\b(physical therapy|occupational therapy|speech therapy|referral|referred|specialist|pt eval|eye exam|hearing test|cardiolog|neurolog|dermatolog|orthoped|podiatr|ophthalm|audiolog|optometr|gastroenterolog|urolog|endocrinolog|pulmonolog|rheumatolog|oncolog|nephrolog)/.test(t)) return "referral";
  if (/\b(return visit|appointment|follow[- ]?up|come back|return (?:to (?:the )?clinic|in)|see (?:dr|your doctor)|recheck|visit with)\b/.test(t)) return "appointment";
  if (/\b(pharmacy|refill|prescription|pick up (?:your |the )?(?:medicine|medication|meds))\b/.test(t)) return "pharmacy";
  return "home";
}

const VERB_START_RE = IMPERATIVE_RE;

/** Split one line into several tasks only when every part starts with a verb. */
export function splitTasks(line: string): string[] {
  const seps: [RegExp, number][] = [
    [/^;\s*/, 1],
    [/^\.\s+(?=[A-Z])/, 1],
    [/^\s+and\s+(?=[a-z])/i, 4],
  ];
  for (const [sep, minWords] of seps) {
    const parts = splitTopLevel(line, sep);
    if (parts.length > 1 && parts.every((p) => VERB_START_RE.test(p.trim()) && wordCount(p) >= minWords)) return parts;
  }
  return [line];
}

export function makeTask(text: string, confident: boolean, sourceQuote?: string): Task {
  const timing = TIMING_RE.exec(text);
  let title = text;
  let dueText: string | undefined;
  if (timing) {
    dueText = timing[0].trim().toLowerCase();
    const without = (text.slice(0, timing.index) + text.slice(timing.index + timing[0].length))
      .replace(/\s+([.,;])/g, "$1")
      .replace(/\s{2,}/g, " ")
      .replace(/\b(?:to|and)\s*$/i, "")
      .trim();
    if (wordCount(without) >= 3) title = without;
  }
  return {
    id: itemId("task"),
    title: cleanItem(title),
    category: categorize(text),
    dueText: dueText ? capitalize(dueText).toLowerCase() : undefined,
    sourceQuote: sourceQuote?.trim() || undefined,
    confidence: confident ? "high" : "low",
  };
}
