/**
 * Strips identifiers that a handoff does not need from the source text before it is
 * stored (Section 5.5): full-name lines, date of birth, MRN, address, phone, insurance
 * and member IDs, SSNs.
 */

const LINE_LABELS =
  /^\s*(?:patient(?:\s+name)?|name|dob|d\.o\.b\.?|date of birth|birth ?date|mrn|medical record(?: number| #)?|account(?: number| #)?|acct|address|home address|street|phone|home phone|cell|mobile|insurance(?: id)?|member id|subscriber id|policy(?: number| #)?|group(?: number| #)?|ssn|social security(?: number)?|emergency contact|guarantor)\s*(?:#|no\.?)?\s*:/i;

const INLINE: [RegExp, string][] = [
  [/\b(dob|d\.o\.b\.?|date of birth|birth ?date)\s*:?\s*\S+(?:\s+\d{1,2},?\s+\d{4})?/gi, "$1: [removed]"],
  [/\b(mrn|medical record(?: number)?|acct|account)\s*(?:#|no\.?)?\s*:?\s*[A-Z0-9-]{4,}/gi, "$1: [removed]"],
  [/\b(insurance(?: id)?|member id|subscriber id|policy(?: number)?|group(?: number)?)\s*(?:#|no\.?)?\s*:?\s*[A-Z0-9-]{4,}/gi, "$1: [removed]"],
  [/\b\d{3}-\d{2}-\d{4}\b/g, "[removed]"],
  [/(?:\+?1[\s.-]?)?\(?\b\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}\b/g, "[phone removed]"],
  [/\b(patient(?:\s+name)?|name)\s*:\s*[^\n]*?(?=\s{2,}|\s+(?:visit date|date|provider|dob|mrn)\b|$)/gi, "$1: [removed]"],
  [/\b\d{1,6}\s+[A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+){0,3}\s+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr|Court|Ct|Way|Place|Pl|Terrace)\b\.?(?:,?\s+(?:Apt|Unit|#)\s*\w+)?/g, "[address removed]"],
];

export function scrubIdentifiers(text: string): string {
  return text
    .split(/\r?\n/)
    .map((line) => {
      // Keep the first field of mixed header lines (e.g. "Visit date: ... Provider: ...") by scrubbing inline.
      let out = line;
      for (const [re, rep] of INLINE) out = out.replace(re, rep);
      if (LINE_LABELS.test(out) && !/(visit date|provider|reason for visit)/i.test(out)) {
        return out.replace(/:\s*.*$/, ": [removed]");
      }
      return out;
    })
    .join("\n");
}
