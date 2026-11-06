/**
 * Turning the RxNorm display list into suggestions people recognise.
 * RxNorm uses "tall man" letters (metFORMIN, hydroCHLOROthiazide) to tell look-alike names apart
 * on pharmacy shelves; in a suggestion list they read as shouting, so they are shown in plain case.
 */
const TALL_MAN = /[a-z][A-Z]{2,}|[A-Z]{2,}[a-z]/;

/** "metFORMIN / SITagliptin" -> "Metformin / sitagliptin". Ordinary names keep their case. */
export function displayDrugName(name: string): string {
  const words = name.split(/(\s+|\/|-)/);
  const plain = words.map((word) => (TALL_MAN.test(word) || (word.length > 3 && word === word.toUpperCase() && /[A-Z]/.test(word)) ? word.toLowerCase() : word)).join("");
  return plain.charAt(0).toUpperCase() + plain.slice(1);
}

/** Salt and form words that make a second, near-identical suggestion ("Lisinopril anhydrous"). */
const NOISE = /\b(anhydrous|hydrochloride|hcl|sodium|potassium|calcium|magnesium|sulfate|succinate|tartrate|besylate|maleate|mesylate|citrate|acetate|phosphate|monohydrate|dihydrate)\b/i;

/**
 * Best matches first: names that start with what was typed, single medicines before combinations,
 * plain names before salts, then shorter names. A match inside a word ("glulisine" for "lisin") is left out.
 */
export function rankDrugNames(list: readonly string[], query: string, limit = 8): string[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const wordStart = new RegExp(`(^|[\\s/-])${escaped}`);
  const scored: { name: string; score: number }[] = [];
  for (const raw of list) {
    const lower = raw.toLowerCase();
    if (!wordStart.test(lower)) continue;
    let score = lower.startsWith(q) ? 0 : 100;
    if (lower.includes(" / ")) score += 30;
    if (NOISE.test(lower)) score += 15;
    score += Math.min(raw.length, 60) / 10;
    scored.push({ name: raw, score });
  }
  scored.sort((a, b) => a.score - b.score || a.name.localeCompare(b.name));
  const seen = new Set<string>();
  const out: string[] = [];
  for (const { name } of scored) {
    const shown = displayDrugName(name);
    const key = shown.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(shown);
    if (out.length >= limit) break;
  }
  return out;
}
