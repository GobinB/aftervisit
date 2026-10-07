/**
 * Step 3: section split. Lines that look like headings (short and ending with a colon,
 * or ALL CAPS, or a known Title Case heading) open a section. Inline headings
 * ("Call the clinic if: fever, chills") apply to that line only.
 */
import type { MedicationChange } from "../schema";
import { MED_GROUP_HEADING_RE } from "./normalize";
import { wordCount } from "./util";

const SMALL_WORDS = new Set(["from", "with", "your", "this", "that", "into", "about", "after", "before", "what", "when", "which", "have", "these"]);

export type SectionKind = "medications" | "tasks" | "watch" | "questions" | "summary" | "unknown";

export interface SectionInfo {
  kind: SectionKind;
  /** For medication sections like Epic's "STOP taking these medications". */
  medKindHint?: MedicationChange["kind"];
}

// Order matters: the first rule that matches wins.
const RULES: { kind: SectionKind; re: RegExp }[] = [
  {
    kind: "watch",
    re: /\b(call (the clinic|the office|us|your (doctor|provider|care team)|911)|seek (medical )?(care|attention|help)|warning signs|if you notice|emergency|when to call|red flags|watch for|return precautions|go to the (er|emergency)|get help right away)\b/i,
  },
  {
    kind: "questions",
    re: /\b(discuss at (the |your )?next visit|questions?( for| to ask)?|to discuss|things to ask|ask (about|your))\b/i,
  },
  {
    kind: "unknown",
    re: /\b(vitals?|vital signs|allergies|immunizations?|results?|today's visit|visit information|vitals and measurements)\b/i,
  },
  {
    kind: "medications",
    re: /\b(medications?|medicines?|prescriptions?|rx|meds|start taking|stop taking|continue taking|change how you take|drug list)\b/i,
  },
  {
    kind: "tasks",
    re: /\b(orders?|referrals?|labs?|tests?|imaging|follow[- ]?up|return( visit)?|schedule|appointments?|instructions|next steps|to[- ]do|what's next|what to do|upcoming|self[- ]care|home care|activity|diet)\b/i,
  },
  {
    kind: "summary",
    re: /\b(assessment|plan|summary|diagnos[ie]s|impression|problem list|history of present illness|hpi)\b/i,
  },
];

export function classifyHeading(label: string): SectionInfo | null {
  const l = label.toLowerCase();
  for (const r of RULES) {
    if (r.re.test(l)) {
      const info: SectionInfo = { kind: r.kind };
      if (r.kind === "medications") {
        if (/\b(start|new|begin|added)\b/.test(l)) info.medKindHint = "new";
        else if (/\b(stop|discontinue|discontinued|hold)\b/.test(l)) info.medKindHint = "stopped";
        else if (/\b(continue|not changed|unchanged|current|keep)\b/.test(l)) info.medKindHint = "continue";
        else if (/\b(change|changed|adjust)\b/.test(l)) info.medKindHint = "dose_changed";
      }
      return info;
    }
  }
  return null;
}

/** A line that is a heading on its own (no content after it). */
export function headingOf(line: string): SectionInfo | null {
  const t = line.trim();
  if (t.length > 70) return null;
  if (MED_GROUP_HEADING_RE.test(t)) return classifyHeading(t);
  const words = wordCount(t);
  const endsColon = /:$/.test(t);
  const letters = t.replace(/[^A-Za-z]/g, "");
  const allCaps = letters.length >= 3 && letters === letters.toUpperCase() && words <= 9;
  const titleCase =
    words <= 6 &&
    !/[.!?,;]$/.test(t) &&
    t
      .replace(/:$/, "")
      .split(/\s+/)
      .filter((w) => w.length > 3 && !SMALL_WORDS.has(w.toLowerCase()))
      .every((w) => /^[A-Z'"(]/.test(w));
  if (!(endsColon && words <= 8) && !allCaps && !titleCase) return null;

  const label = t.replace(/:$/, "");
  const info = classifyHeading(label);
  if (info) return info;
  // A short line ending with a colon or in ALL CAPS is a heading even when we do not know it.
  if ((endsColon && words <= 6) || (allCaps && words <= 6 && !/\d/.test(t))) return { kind: "unknown" };
  return null;
}

/** "Call the clinic if: fever, chills" -> label + content. Only for known section labels. */
export function inlineHeadingOf(line: string): { info: SectionInfo; label: string; content: string } | null {
  const m = /^([A-Za-z][A-Za-z0-9 /&'’()-]{1,45}?)\s*:\s*(\S.*)$/.exec(line.trim());
  if (!m) return null;
  const label = m[1].trim();
  if (wordCount(label) > 7) return null;
  const info = classifyHeading(label);
  if (!info) return null;
  return { info, label, content: m[2].trim() };
}
