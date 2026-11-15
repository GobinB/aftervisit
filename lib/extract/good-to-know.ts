/**
 * "Good to know": instructions in a visit summary that are neither a medicine nor something to do
 * once ("Avoid caffeine", "Low-salt diet", "No driving for two weeks").
 *
 * The built-in reader ends up with every line it could not place. Most of those are not advice at
 * all (the clinic's address, a phone number, vital signs, a signature), so only the lines that read
 * like an instruction are kept for the draft. The rest are still in the original, which sits beside
 * the draft on the review screen. The model is asked for this list directly (lib/extract/openai.ts).
 */
const STARTS_LIKE_ADVICE =
  /^(?:please\s+)?(?:avoid|do not|don['’]t|never|no\s+[a-z]|limit|reduce|keep|drink|eat|rest|wear|elevate|raise|ice|you (?:may|can|should|must|need)|it is (?:ok|okay|safe|important|normal)|it['’]s (?:ok|okay|safe|important|normal)|ok to|okay to|may\s+[a-z]|resume|return to|continue\s+[a-z]|try to|make sure|be sure|remember|diet\b|activity\b|fluids?\b)/i;
const READS_LIKE_ADVICE =
  /\b(?:diet|as tolerated|should|must not|need to|needs to|important to|make sure|be sure to|remember to|try to|not allowed|allowed to|restrictions?|caffeine|alcohol|smoking|driving|lifting|bed ?rest|weight[- ]bearing|shower|bathe?|fluids)\b/i;
/** Phone numbers, web and street addresses, page furniture and sign-offs are never advice. */
const NOT_ADVICE =
  /\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b|\(\d{3}\)\s*\d{3}|https?:\/\/|www\.|@\w+\.\w+|\b(?:suite|ste\.?|fax|mrn|dob|date of birth|page \d+|printed|electronically signed|signed by|thank you for)\b|\b\d{5}(?:-\d{4})?$/i;

export function isGoodToKnow(line: string): boolean {
  const text = line.trim();
  if (text.length < 6 || text.length > 300) return false;
  if (text.split(/\s+/).length < 2) return false;
  if (/:$/.test(text) || NOT_ADVICE.test(text)) return false;
  return STARTS_LIKE_ADVICE.test(text) || READS_LIKE_ADVICE.test(text);
}

/** The built-in reader's leftover lines, cut down to the ones worth listing as good to know. */
export function goodToKnowLines(lines: readonly string[]): string[] {
  const seen = new Set<string>();
  return lines.filter((line) => {
    const key = line.trim().toLowerCase();
    if (!isGoodToKnow(line) || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
