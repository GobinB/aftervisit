import type { HandoffDraft } from "../schema";

/**
 * One draft from the drafts of a long summary sent in parts (pages 1 to 6, then 7 to 9).
 * The visit comes from the first part, with gaps filled from later parts; every item is kept, in order.
 */
export function mergeDrafts(drafts: HandoffDraft[]): HandoffDraft {
  if (drafts.length === 1) return drafts[0];
  const [first, ...rest] = drafts;
  const visit = { ...first.visit };
  for (const d of rest) {
    for (const key of Object.keys(d.visit) as (keyof typeof visit)[]) {
      if (key !== "summary" && !visit[key] && d.visit[key]) Object.assign(visit, { [key]: d.visit[key] });
    }
  }
  visit.summary = drafts
    .map((d) => d.visit.summary.trim())
    .filter(Boolean)
    .join(" ")
    .slice(0, 2000);
  const unique = (xs: string[]) => [...new Set(xs)];
  return {
    visit,
    medications: drafts.flatMap((d) => d.medications).slice(0, 100),
    tasks: drafts.flatMap((d) => d.tasks).slice(0, 100),
    watchFor: unique(drafts.flatMap((d) => d.watchFor)).slice(0, 100),
    questions: unique(drafts.flatMap((d) => d.questions)).slice(0, 100),
    otherNotes: unique(drafts.flatMap((d) => d.otherNotes)).slice(0, 300),
    sourceText: drafts
      .map((d) => d.sourceText)
      .filter(Boolean)
      .join("\n\n")
      .slice(0, 100_000),
  };
}

/** Splits page sizes (bytes) into runs that each fit one request. A page bigger than the limit goes alone. */
export function batchPages(sizes: number[], maxBytes: number): number[][] {
  const batches: number[][] = [];
  let current: number[] = [];
  let total = 0;
  sizes.forEach((size, i) => {
    if (current.length && total + size > maxBytes) {
      batches.push(current);
      current = [];
      total = 0;
    }
    current.push(i);
    total += size;
  });
  if (current.length) batches.push(current);
  return batches;
}
