/**
 * Step 2: visit header. Date, provider, specialty, reason for visit, clinic name and
 * patient first name from labelled fields ("Provider:", "Reason for visit:") and
 * credential patterns ("Anita Patel, MD").
 */
import { DATE_RE, capitalize, stripTrailingPunct, toIsoDate, wordCount } from "./util";

/** Short lines that carry an MRN / DOB anywhere are identifier lines. */
export function isIdentifierLine(line: string): boolean {
  if (IDENTIFIER_LINE_RE.test(line)) return true;
  return line.length < 120 && /\b(?:MRN|DOB|D\.O\.B\.|date of birth|medical record (?:number|#)|SSN)\b\s*(?:#|no\.?)?\s*:?\s*[\dA-Z]/i.test(line);
}

/** Words left on a line once a matched fragment is removed. */
function leftoverWords(line: string, fragment: string): number {
  return wordCount(line.replace(fragment, " ").replace(/[^A-Za-z0-9\s]/g, " "));
}

const LABELS = [
  "patient name",
  "patient",
  "name",
  "visit date",
  "date of visit",
  "date of service",
  "encounter date",
  "appointment date",
  "visit on",
  "seen on",
  "date",
  "provider",
  "seen by",
  "attending",
  "physician",
  "clinician",
  "department",
  "specialty",
  "location",
  "clinic",
  "facility",
  "reason for visit",
  "reason for your visit",
  "visit reason",
  "chief complaint",
  "you were seen for",
  "you were seen today for",
  "dob",
  "date of birth",
  "birth date",
  "mrn",
  "medical record number",
  "account",
  "acct",
  "insurance",
  "member id",
  "policy",
  "address",
  "phone",
  "age",
  "sex",
  "gender",
  "pcp",
  "primary care provider",
];

const LABEL_ALT = LABELS.map((l) => l.replace(/ /g, "\\s+")).join("|");
/** A line that begins with a known header label. */
export const HEADER_LINE_RE = new RegExp(String.raw`^(?:${LABEL_ALT})\s*(?:#|no\.?)?\s*:`, "i");
/** Identifier-only lines we deliberately drop from the draft (never shown). */
export const IDENTIFIER_LINE_RE =
  /^(?:dob|date of birth|birth date|mrn|medical record(?: number)?|account|acct|insurance|member id|policy|address|phone|ssn|social security)\b\s*(?:#|no\.?)?\s*:?/i;

function field(line: string, labels: string[]): string | undefined {
  const alt = labels.map((l) => l.replace(/ /g, "\\s+")).join("|");
  const re = new RegExp(
    String.raw`(?:^|\s|\|)(?:${alt})\s*:\s*(.+?)(?=\s+(?:${LABEL_ALT})\s*(?:#|no\.?)?\s*:|\s*\|\s*|$)`,
    "i",
  );
  const m = re.exec(line);
  return m ? stripTrailingPunct(m[1]) : undefined;
}

const CRED = String.raw`(?:MD|M\.D\.|DO|D\.O\.|NP|FNP|FNP-C|DNP|PA-C|PA|APRN|ARNP|CNM|RN)`;
const NAME = String.raw`[A-Z][a-zA-Z'’-]+(?:\s+[A-Z]\.?(?=\s))?(?:\s+[A-Z][a-zA-Z'’-]+){0,2}`;
const PROVIDER_CRED_RE = new RegExp(String.raw`(?:Dr\.?\s+)?(${NAME}),?\s+(${CRED})\b(?:\s*\(([^)]{3,60})\))?`);
const DR_NAME_RE = new RegExp(String.raw`\bDr\.?\s+(${NAME})`);

export interface HeaderInfo {
  patientFirstName?: string;
  date?: string;
  provider?: string;
  specialty?: string;
  clinic?: string;
  reason?: string;
}

function formatProvider(name: string, cred: string): string {
  const c = cred.replace(/\./g, "").toUpperCase();
  const clean = name.trim().replace(/^Dr\.?\s+/, "");
  if (c === "MD" || c === "DO") return `Dr. ${clean}`;
  return `${clean}, ${c}`;
}

export function looksLikeClinicLine(line: string): boolean {
  if (line.length > 90 || HEADER_LINE_RE.test(line)) return false;
  const letters = line.replace(/[^A-Za-z]/g, "");
  const caps = letters.length > 3 && letters === letters.toUpperCase();
  return (
    caps ||
    /\b(clinic|medical|health|hospital|center|centre|medicine|associates|practice|urgent care|care|physicians|family|pediatrics|cardiology)\b/i.test(line)
  );
}

export function cleanClinicName(line: string): string {
  let s = line
    .replace(/\s*[-–—|:]\s*(after[\s-]?visit summary|visit summary|patient instructions|discharge instructions|clinical summary|avs)\b.*$/i, "")
    .replace(/^(after[\s-]?visit summary|visit summary)\s*[-–—|:]\s*/i, "")
    .trim();
  if (s === s.toUpperCase()) {
    s = s
      .toLowerCase()
      .replace(/\b([a-z])/g, (c) => c.toUpperCase())
      .replace(/\b(Of|And|The|At|For)\b/g, (w) => w.toLowerCase());
  }
  return s;
}

/** Extract header fields from the given lines. Returns which line indexes were consumed. */
export function parseHeader(
  lines: string[],
  patientFirstName?: string,
): { info: HeaderInfo; consumed: Set<number> } {
  const info: HeaderInfo = {};
  const consumed = new Set<number>();
  if (patientFirstName?.trim()) info.patientFirstName = capitalize(patientFirstName.trim());

  // Clinic name on the first non-empty line.
  if (lines.length && looksLikeClinicLine(lines[0])) {
    const name = cleanClinicName(lines[0]);
    if (name && !/^(after[\s-]?visit summary|visit summary)$/i.test(name)) info.clinic = name;
    consumed.add(0);
  }

  let datedFromLabel = false;
  // Only scan the top of the document for loose provider/date matches.
  const headerZone = Math.min(lines.length, 25);

  lines.forEach((line, i) => {
    const isHeaderLine = HEADER_LINE_RE.test(line) || /\s(?:visit date|provider|reason for visit)\s*:/i.test(line);
    if (isIdentifierLine(line)) consumed.add(i);
    if (!isHeaderLine) return;

    const patient = field(line, ["patient name", "patient", "name"]);
    if (patient && !info.patientFirstName) {
      const first = patient.replace(/^(mr|mrs|ms|miss)\.?\s+/i, "").split(/[\s,]+/)[0];
      // "Last, First" form
      const parts = patient.split(",").map((p) => p.trim());
      const firstName = parts.length === 2 && parts[1] ? parts[1].split(/\s+/)[0] : first;
      if (firstName && /^[A-Za-z'-]{2,}$/.test(firstName)) info.patientFirstName = capitalize(firstName.toLowerCase());
    }

    const dateStr = field(line, [
      "visit date",
      "date of visit",
      "date of service",
      "encounter date",
      "appointment date",
      "visit on",
      "seen on",
      "date",
    ]);
    if (dateStr && !datedFromLabel) {
      const iso = toIsoDate(dateStr);
      if (iso) {
        info.date = iso;
        datedFromLabel = true;
      }
    }

    const prov = field(line, ["provider", "seen by", "attending", "physician", "clinician"]);
    if (prov && !info.provider) {
      const m = PROVIDER_CRED_RE.exec(prov);
      if (m) {
        info.provider = formatProvider(m[1], m[2]);
        if (m[3] && !info.specialty) info.specialty = m[3].trim();
      } else {
        info.provider = prov.replace(/\s*\(.*\)\s*$/, "");
        const sp = /\(([^)]{3,60})\)/.exec(prov);
        if (sp && !info.specialty) info.specialty = sp[1].trim();
      }
    }

    const spec = field(line, ["specialty", "department"]);
    if (spec && !info.specialty) info.specialty = spec;

    const loc = field(line, ["clinic", "location", "facility"]);
    if (loc && !info.clinic) info.clinic = loc;

    const reason = field(line, [
      "reason for visit",
      "reason for your visit",
      "visit reason",
      "chief complaint",
      "you were seen today for",
      "you were seen for",
    ]);
    if (reason && !info.reason) info.reason = capitalize(reason);

    consumed.add(i);
  });

  // Fallbacks within the header zone: an unlabelled "Name, MD" and the first date not on a DOB line.
  for (let i = 0; i < headerZone; i++) {
    const line = lines[i];
    if (!info.provider) {
      const m = PROVIDER_CRED_RE.exec(line) ?? null;
      if (m) {
        info.provider = formatProvider(m[1], m[2]);
        if (m[3] && !info.specialty) info.specialty = m[3].trim();
        if (leftoverWords(line, m[0]) <= 3) consumed.add(i);
      } else {
        const d = DR_NAME_RE.exec(line);
        if (d && /\b(seen by|with|provider|visit)\b/i.test(line) && i < 12) info.provider = `Dr. ${d[1]}`;
      }
    }
    if (!info.date && !isIdentifierLine(line) && !/birth|dob/i.test(line)) {
      const iso = toIsoDate(line);
      if (iso) {
        info.date = iso;
        const dm = DATE_RE.exec(line);
        // "10/14/2026  Office Visit  Lakeside Family Medicine"
        const visitLine = /^\s*\S+\s+(?:office visit|clinic visit|visit|telehealth visit|video visit|telemedicine)\b\s*(.*)$/i.exec(
          dm ? line.replace(dm[0], dm[0].replace(/\s+/g, "")) : line,
        );
        if (visitLine && dm && line.trim().startsWith(dm[0])) {
          if (!info.clinic && visitLine[1] && looksLikeClinicLine(visitLine[1])) info.clinic = cleanClinicName(visitLine[1]);
          consumed.add(i);
        } else if (dm && leftoverWords(line, dm[0]) <= 2) consumed.add(i);
      }
    }
  }

  // "Visit with Dr. Sam Lee on Oct 1, 2026 (Neurology)"
  for (let i = 0; i < Math.min(lines.length, 6); i++) {
    const line = lines[i];
    if (consumed.has(i)) continue;
    if (/^(?:your\s+)?(?:visit|appointment|seen|telehealth visit|video visit)\b/i.test(line) && DATE_RE.test(line) && /\b(?:Dr\.?\s|MD\b|DO\b|NP\b|PA\b)/.test(line)) {
      const sp = /\(([A-Za-z &/-]{3,40})\)\s*$/.exec(line);
      if (sp && !info.specialty) info.specialty = sp[1].trim();
      consumed.add(i);
    }
  }

  return { info, consumed };
}
