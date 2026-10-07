/**
 * Built-in heuristic parser (Section 5.3). Deterministic, no network, no API key.
 * Every non-heading source line is placed in exactly one bucket; anything that matches
 * no classifier goes to otherNotes, in source order. Nothing is invented or dropped.
 */
import type { HandoffDraft, MedicationChange, Task } from "../schema";
import { isIdentifierLine, parseHeader } from "./header";
import { classifyMedication, DOSE_RE, expandAbbreviations } from "./medications";
import { normalize } from "./normalize";
import { headingOf, inlineHeadingOf, type SectionInfo } from "./sections";
import { categorize, hasTiming, isImperative, makeTask, splitTasks } from "./tasks";
import { cleanItem, firstWords, splitTopLevel } from "./util";

/** "Questions? Call the clinic at 555-0142." is contact info, not a warning sign. */
const CONTACT_LINE_RE = /^(?:questions\??|for questions|if you have questions)|\b\d{3}[-.\s]\d{4}\b(?![^]*\bif\b)/i;
import { QUESTION_TRIGGER_RE, WATCH_TRIGGER_RE, questionItems, splitWatch, watchItemsFromSentence } from "./watch";

export type Bucket =
  | "heading"
  | "visit"
  | "identifier"
  | "summary"
  | "medication"
  | "task"
  | "watch"
  | "question"
  | "other";

export interface ParseTrace {
  lines: string[];
  buckets: Bucket[];
}

export interface ParseInput {
  text: string;
  patientFirstName?: string;
}

const SUMMARY_WORDS = 60;

export function parseWithTrace(input: ParseInput): { draft: HandoffDraft; trace: ParseTrace } {
  const norm = normalize(input.text);
  const lines = norm.map((l) => l.text);
  const buckets: Bucket[] = new Array(lines.length).fill("other");

  const { info, consumed } = parseHeader(lines, input.patientFirstName);

  const medications: MedicationChange[] = [];
  const tasks: Task[] = [];
  const watchFor: string[] = [];
  const questions: string[] = [];
  const otherNotes: string[] = [];
  const summaryParts: string[] = [];

  let section: SectionInfo = { kind: "unknown" };
  let lastBucket: Bucket | null = null;

  let currentLine = "";
  const addTasks = (text: string, confident: boolean) => {
    for (const part of splitTasks(text)) tasks.push(makeTask(part, confident, currentLine));
  };
  const withQuote = (m: MedicationChange): MedicationChange => ({ ...m, sourceQuote: currentLine });

  lines.forEach((line, i) => {
    currentLine = line;
    if (consumed.has(i)) {
      buckets[i] = isIdentifierLine(line) ? "identifier" : "visit";
      return;
    }

    const heading = headingOf(line);
    if (heading) {
      section = heading;
      buckets[i] = "heading";
      lastBucket = "heading";
      return;
    }

    // An Assessment / Plan paragraph ends at a blank line.
    if (section.kind === "summary" && norm[i].paragraphStart && lastBucket !== "heading") section = { kind: "unknown" };

    // Inline heading: "Call the clinic if: fever, chills". Applies to this line only.
    const inline = inlineHeadingOf(line);
    const ctx: SectionInfo = inline ? inline.info : section;
    const content = inline ? inline.content : line;

    const place = (b: Bucket) => {
      buckets[i] = b;
      lastBucket = b;
    };

    // Medications: dose pattern anywhere, or any named line in a Medications section.
    const inMeds = ctx.kind === "medications";
    const startsWithNonMedTask =
      isImperative(content) && !/^(?:please\s+)?(?:take|use|apply|start|stop|continue|keep taking|increase|decrease)\b/i.test(content);
    if (!startsWithNonMedTask && (inMeds || (DOSE_RE.test(content) && !WATCH_TRIGGER_RE.test(content)))) {
      // "Stop ibuprofen; use acetaminophen 500 mg" is two medications.
      const parts = splitTopLevel(content, /^;\s*/);
      if (parts.length > 1) {
        const meds = parts.map((p) => classifyMedication(p, true, ctx.medKindHint));
        if (meds.every(Boolean)) {
          medications.push(...(meds as MedicationChange[]).map(withQuote));
          return place("medication");
        }
      }
      const med = classifyMedication(content, inMeds, ctx.medKindHint);
      if (med) {
        medications.push(withQuote(med));
        return place("medication");
      }
      // A sig line with no drug name ("Take 1 tablet by mouth daily") belongs to the previous medication.
      if (lastBucket === "medication" && medications.length) {
        const prev = medications[medications.length - 1];
        prev.detail = `${prev.detail}. ${cleanItem(expandAbbreviations(content))}`;
        prev.sourceQuote = prev.sourceQuote ? `${prev.sourceQuote} ${line}` : line;
        return place("medication");
      }
    }

    if (ctx.kind === "watch" && !CONTACT_LINE_RE.test(content)) {
      const items = inline ? splitWatch(content) : watchItemsFromSentence(content);
      watchFor.push(...items);
      return place("watch");
    }

    if (ctx.kind === "questions") {
      if (isImperative(content) && !/^(?:ask|discuss|consider)\b/i.test(content) && !/\?$/.test(content)) {
        addTasks(content, true);
        return place("task");
      }
      questions.push(...questionItems(content));
      return place("question");
    }

    // Global triggers, in order: watch, question, task.
    if (WATCH_TRIGGER_RE.test(line) && !CONTACT_LINE_RE.test(line)) {
      watchFor.push(...watchItemsFromSentence(line));
      return place("watch");
    }
    if (QUESTION_TRIGGER_RE.test(line)) {
      questions.push(...questionItems(line));
      return place("question");
    }

    const imperative = isImperative(content) || isImperative(line);
    const timing = hasTiming(line);
    if (ctx.kind === "tasks" && (imperative || timing || inline || categorize(content) !== "home")) {
      addTasks(inline ? line : content, imperative || timing);
      return place("task");
    }
    // Inside Assessment / Plan, only an explicit instruction becomes a task; the rest is the summary.
    if (ctx.kind === "summary" && !imperative) {
      summaryParts.push(content);
      return place("summary");
    }
    if (imperative || timing) {
      addTasks(line, imperative);
      return place("task");
    }

    if (ctx.kind === "summary") {
      summaryParts.push(content);
      return place("summary");
    }

    otherNotes.push(line);
    place("other");
  });

  // The summary takes whole lines up to 60 words; lines that do not fit stay visible under Other notes.
  const kept: string[] = [];
  const overflow: string[] = [];
  let words = 0;
  for (const part of summaryParts) {
    const n = part.split(/\s+/).length;
    if (overflow.length === 0 && words + n <= SUMMARY_WORDS) {
      kept.push(part);
      words += n;
    } else if (kept.length === 0) {
      kept.push(firstWords(part, SUMMARY_WORDS));
      overflow.push(part);
      words = SUMMARY_WORDS;
    } else {
      overflow.push(part);
    }
  }
  const summary = kept.join(" ").replace(/\s+/g, " ").trim();
  otherNotes.unshift(...overflow);

  const draft: HandoffDraft = {
    visit: {
      patientFirstName: info.patientFirstName,
      date: info.date,
      provider: info.provider,
      specialty: info.specialty,
      clinic: info.clinic,
      reason: info.reason,
      summary,
    },
    medications,
    tasks,
    watchFor,
    questions,
    otherNotes,
    sourceText: input.text.trim(),
  };
  return { draft, trace: { lines, buckets } };
}

export function parse(input: ParseInput): HandoffDraft {
  return parseWithTrace(input).draft;
}

/** True when the parser could not place anything into a structured section. */
export function isUnsorted(draft: HandoffDraft): boolean {
  return (
    draft.medications.length === 0 &&
    draft.tasks.length === 0 &&
    draft.watchFor.length === 0 &&
    draft.questions.length === 0 &&
    !draft.visit.summary
  );
}
