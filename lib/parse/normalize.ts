/**
 * Step 1: normalize raw text (pasted, PDF text layer or OCR) into clean lines.
 * Collapses whitespace, fixes common OCR artifacts in dose numbers, strips bullets
 * and joins lines that wrap mid-sentence.
 */

const BULLET_RE = /^\s*(?:[-–—•*·▪●◦‣○□■➢►>]+|\(?\d{1,2}[.)]|\(?[a-hA-H][.)](?=\s))\s*/;
const DOSE_UNIT = String.raw`(?:mg|mcg|µg|ml|mL|units?|tabs?|tablets?|capsules?|puffs?|drops?|g)\b`;

/** OCR often reads 1 as l/I and 0 as O inside numbers: "l0 mg" -> "10 mg", "2O mg" -> "20 mg". */
export function fixOcrDigits(line: string): string {
  return line.replace(new RegExp(String.raw`\b([0-9lIO]*[0-9][0-9lIO]*|[lI][0-9O]+)(\s?${DOSE_UNIT})`, "g"), (_m, num: string, unit: string) => {
    return num.replace(/[lI]/g, "1").replace(/O/g, "0") + unit;
  });
}

export function stripBullet(line: string): string {
  return line.replace(BULLET_RE, "");
}

/** ALL CAPS lines and Epic-style medication group headings never absorb the next line. */
function looksLikeHeadingLine(s: string): boolean {
  const letters = s.replace(/[^A-Za-z]/g, "");
  if (letters.length >= 3 && letters === letters.toUpperCase()) return true;
  return MED_GROUP_HEADING_RE.test(s);
}

/** Epic: "START taking these medications", "CHANGE how you take these medications", ... */
export const MED_GROUP_HEADING_RE =
  /^(?:START|STOP|CHANGE|CONTINUE|TAKE|ASK)\b[a-z ]{0,30}\b(?:these|how you take)\b[A-Za-z ,']*$/;

export interface NormalizedLine {
  text: string;
  /** True when this line follows a blank line (paragraph start). */
  paragraphStart: boolean;
}

export function normalize(raw: string): NormalizedLine[] {
  const text = raw
    .replace(/\r\n?/g, "\n")
    .replace(/[  -​  　\t]/g, " ")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/ﬁ/g, "fi")
    .replace(/ﬂ/g, "fl");

  const out: NormalizedLine[] = [];
  let blankBefore = true;
  for (const rawLine of text.split("\n")) {
    const hadBullet = BULLET_RE.test(rawLine) && rawLine.trim().length > 1;
    let line = stripBullet(rawLine).replace(/\s+/g, " ").trim();
    line = fixOcrDigits(line).replace(/(^|[.!?]\s+)l([ft])\b/g, (_m, pre: string, c: string) => `${pre}I${c}`).replace(/\blf\b/g, "if");
    if (!line || /^[-_=*.·•\s]+$/.test(line)) {
      blankBefore = true;
      continue;
    }
    const prev = out[out.length - 1];
    // Join a line that wraps mid-sentence: next line starts lowercase and was not its own bullet.
    if (
      prev &&
      !blankBefore &&
      !hadBullet &&
      /^[a-z(]/.test(line) &&
      !/[.!?:]$/.test(prev.text) &&
      !looksLikeHeadingLine(prev.text)
    ) {
      // Mid-word hyphenation from PDFs: "medi-\ncation"
      if (/[a-z]-$/.test(prev.text)) prev.text = prev.text.slice(0, -1) + line;
      else prev.text = `${prev.text} ${line}`;
      continue;
    }
    out.push({ text: line, paragraphStart: blankBefore });
    blankBefore = false;
  }
  return out;
}
