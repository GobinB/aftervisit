/**
 * Step 0: page furniture. Photographed summaries arrive as one text per page, joined with
 * a form feed. Each printed page repeats the same letterhead, patient name / DOB / MRN line,
 * "Printed on ..." stamp and "Page 2 of 3" footer.
 *
 * This is the one deliberate exception to "nothing is dropped": furniture is removed before
 * the parser sees the text, so it never shows up as a note or splits a list in two. Only
 * two kinds of text go:
 *  - page counters ("Page 2 of 3") and print stamps ("Printed on 11/04/2026 3:14 PM"), and
 *  - lines repeated at the top or bottom of two or more pages. The first copy at the top of
 *    page 1 stays, since that is the real letterhead and the header parser reads it.
 * The caregiver still sees the full original text in the side panel during review.
 */

/** Marks where one page ended and the next began, on a line of its own. */
export const PAGE_BREAK = "\f";

/** How many lines at the top and bottom of each page can be furniture. */
const EDGE_LINES = 3;

const N = String.raw`[0-9lIO]{1,3}`;
/** "Page 2 of 3" at the end of a line; a bare "Page 2" only on a line of its own. */
const PAGE_TAIL_RE = new RegExp(String.raw`\s*[|•·,-]?\s*\bpage\s+${N}\s*(?:of|/)\s*${N}\s*$`, "i");
const PAGE_ONLY_RE = new RegExp(String.raw`^\s*(?:page\s+${N}|-\s*\d{1,3}\s*-)\s*$`, "i");
const OCR_DATE = String.raw`[0-9lIO]{1,2}/[0-9lIO]{1,2}/[0-9lIO]{2,4}`;
const OCR_TIME = String.raw`[0-9lIO]{1,2}:[0-9lIO]{2}(?::[0-9lIO]{2})?\s*(?:[AaPp]\.?\s?[Mm]\.?)?`;
const PRINTED_RE = new RegExp(String.raw`\s*[|•·]?\s*\b(?:printed|print date|date printed)(?:\s+(?:on|at|by \S+ on))?\s*:?\s*${OCR_DATE}(?:,?\s+(?:at\s+)?${OCR_TIME})?`, "i");
const CONTINUED_RE = /^\(?(?:continued(?: on (?:the )?next page)?|continued from (?:the )?previous page|see next page|end of (?:report|document))\)?\.?$/i;
/** Never treat a dose line as furniture, even if it repeats. */
const DOSE_HINT_RE = /\d\s?(?:mg|mcg|ml|units?)\b/i;

/** Remove page counters and print stamps from one line. Returns the cleaned line and what went. */
function stripStamps(line: string): { line: string; removed: string[] } {
  const removed: string[] = [];
  let l = line;
  const page = PAGE_TAIL_RE.exec(l);
  if (page) {
    removed.push(page[0].trim());
    l = l.slice(0, page.index);
  }
  const printed = PRINTED_RE.exec(l);
  if (printed) {
    removed.push(printed[0].trim());
    l = l.slice(0, printed.index) + l.slice(printed.index + printed[0].length);
  }
  if (PAGE_ONLY_RE.test(l) || CONTINUED_RE.test(l.trim())) {
    removed.push(l.trim());
    l = "";
  }
  // Separators left dangling once a stamp is gone: "Cedar Ridge Hospital  |"
  if (removed.length) l = l.replace(/[\s|•·,-]+$/, "").replace(/^[\s|•·,-]+/, "");
  return { line: l, removed };
}

/** Comparison key that survives OCR noise: case, spacing, punctuation, l/1 and O/0. */
function furnitureKey(line: string): string {
  return line
    .toLowerCase()
    .replace(/[il|]/g, "1")
    .replace(/o/g, "0")
    .replace(/[^a-z0-9]/g, "");
}

export interface StrippedText {
  /** Text with furniture removed; pages separated by a PAGE_BREAK line. */
  text: string;
  /** The furniture that was removed, in source order (for tests and debugging). */
  removed: string[];
}

export function stripPageFurniture(raw: string): StrippedText {
  const removed: string[] = [];
  const pages = raw
    .replace(/\r\n?/g, "\n")
    .split("\f")
    .map((page) =>
      page.split("\n").map((line) => {
        const s = stripStamps(line);
        removed.push(...s.removed);
        // A line that was only a stamp becomes blank, not a lost line.
        return s.removed.length && !s.line.trim() ? "" : s.line;
      }),
    )
    .filter((lines) => lines.some((l) => l.trim()));

  if (pages.length > 1) {
    // Lines near the top or bottom of each page, by key.
    const edges = pages.map((lines) => {
      const filled = lines.map((l, i) => (l.trim() ? i : -1)).filter((i) => i >= 0);
      const top = filled.slice(0, EDGE_LINES);
      const bottom = filled.slice(-EDGE_LINES).filter((i) => !top.includes(i));
      return { top, bottom };
    });
    const pagesWithKey = new Map<string, Set<number>>();
    pages.forEach((lines, p) => {
      for (const i of [...edges[p].top, ...edges[p].bottom]) {
        const key = furnitureKey(lines[i]);
        if (key.length < 4 || DOSE_HINT_RE.test(lines[i])) continue;
        if (!pagesWithKey.has(key)) pagesWithKey.set(key, new Set());
        pagesWithKey.get(key)!.add(p);
      }
    });
    const kept = new Set<string>();
    pages.forEach((lines, p) => {
      for (const i of [...edges[p].top, ...edges[p].bottom]) {
        const key = furnitureKey(lines[i]);
        if ((pagesWithKey.get(key)?.size ?? 0) < 2 || DOSE_HINT_RE.test(lines[i])) continue;
        if (p === 0 && edges[0].top.includes(i) && !kept.has(key)) {
          kept.add(key);
          continue;
        }
        removed.push(lines[i].trim());
        lines[i] = "";
      }
    });
  }

  const trimmed = pages.map((lines) => {
    let a = 0;
    let b = lines.length;
    while (a < b && !lines[a].trim()) a++;
    while (b > a && !lines[b - 1].trim()) b--;
    return lines.slice(a, b).join("\n");
  });
  return { text: trimmed.join(`\n${PAGE_BREAK}\n`), removed };
}
