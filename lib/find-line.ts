/**
 * Finds where a sentence sits on a photographed page, so the review screen can mark it.
 *
 * The reader gives the sentence an item came from and its page, not where on the page it is. The
 * phone reads the photo itself (lib/ocr.ts) into lines with their positions, and this picks the
 * line, or the two or three lines in a row, that best match the sentence. It returns nothing when
 * no line matches well enough: a wrong mark is worse than none.
 */

/** A rectangle on the page, as fractions of its width and height. */
export type LineBox = { x: number; y: number; w: number; h: number };

/**
 * One line of text read from a page photo. Positions are fractions of the page (0 to 1). `words`
 * are the boxes of its words: a photographed page is rarely square to the camera, so a line of text
 * slopes, and its words follow the slope where one box around the whole line would not.
 */
export type PageLine = { text: string; x0: number; y0: number; x1: number; y1: number; words?: { x0: number; y0: number; x1: number; y1: number }[] };

/** Where a sentence is: the area to bring into view, and the pieces to mark (one per word, or per line). */
export type LineMark = LineBox & { parts: LineBox[] };

/** Words that matter for matching: lower case, numbers kept, single letters dropped. */
export function lineTokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9.%/]+/g, " ")
    .split(/\s+/)
    .map((token) => token.replace(/^[./]+|[./]+$/g, ""))
    .filter((token) => token.length > 1 || /\d/.test(token));
}

function distance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      best = Math.min(best, row[j]);
    }
    if (best > max) return max + 1;
    prev = row;
  }
  return prev[b.length];
}

/** The phone misreads a letter here and there ("Lisinopri1"), so long words may differ a little. Numbers must match. */
function same(a: string, b: string): boolean {
  if (a === b) return true;
  if (/\d/.test(a) || /\d/.test(b)) return a.replace(/[^a-z0-9]/g, "") === b.replace(/[^a-z0-9]/g, "");
  const allowed = Math.min(a.length, b.length) >= 9 ? 2 : Math.min(a.length, b.length) >= 5 ? 1 : 0;
  return allowed > 0 && distance(a, b, allowed) <= allowed;
}

const MAX_LINES = 3;
/** At least this share of the sentence's words must be on the marked lines. */
const MIN_FOUND = 0.6;

const PAD = 0.003;
const padded = (r: { x0: number; y0: number; x1: number; y1: number }): LineBox => {
  const x = Math.max(0, r.x0 - PAD);
  const y = Math.max(0, r.y0 - PAD / 2);
  return { x, y, w: Math.min(1, r.x1 + PAD) - x, h: Math.min(1, r.y1 + PAD / 2) - y };
};

export function findLine(lines: readonly PageLine[], quote: string): LineMark | null {
  const want = lineTokens(quote);
  if (want.length < 2) return null;
  const tokens = lines.map((line) => lineTokens(line.text));
  let best: { score: number; from: number; to: number } | null = null;
  for (let from = 0; from < lines.length; from++) {
    const have: string[] = [];
    for (let to = from; to < Math.min(lines.length, from + MAX_LINES); to++) {
      if (!tokens[to].length) break;
      have.push(...tokens[to]);
      const pool = [...have];
      let found = 0;
      for (const word of want) {
        const at = pool.findIndex((other) => same(word, other));
        if (at >= 0) {
          found++;
          pool.splice(at, 1);
        }
      }
      const recall = found / want.length;
      const precision = found / have.length;
      if (found < 2 || recall < MIN_FOUND) continue;
      // Mostly how much of the sentence is there; a little for not marking more than the sentence.
      const score = recall * 0.75 + precision * 0.25 - (to - from) * 0.02;
      if (!best || score > best.score) best = { score, from, to };
    }
  }
  if (!best) return null;
  const picked = lines.slice(best.from, best.to + 1);
  const x0 = Math.min(...picked.map((line) => line.x0));
  const y0 = Math.min(...picked.map((line) => line.y0));
  const x1 = Math.max(...picked.map((line) => line.x1));
  const y1 = Math.max(...picked.map((line) => line.y1));
  const all = padded({ x0, y0, x1, y1 });
  return { ...all, parts: picked.flatMap((line) => (line.words?.length ? line.words : [line])).map(padded) };
}
