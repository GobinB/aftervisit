import { z } from "zod";

const line = z.string().trim().min(1).max(1000);
const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value ? value : undefined));

/** Each list is short enough to read on Today; the whole thing stays under the database's size limit. */
export const MAX_VISIT_LINES = 40;

/**
 * What is kept with a visit besides medicines, reminders and appointments: the short summary, what to
 * watch for, good to know, and questions for the next visit. Stored in visits.content.
 */
export const VisitContentSchema = z
  .object({
    clinic: text(300),
    provider: text(300),
    specialty: text(300),
    reason: text(1000),
    summary: z.string().trim().max(2000).default(""),
    watchFor: z.array(line).max(MAX_VISIT_LINES).default([]),
    goodToKnow: z.array(line).max(MAX_VISIT_LINES).default([]),
    questions: z.array(line).max(MAX_VISIT_LINES).default([]),
  })
  .strict();
export type VisitContent = z.infer<typeof VisitContentSchema>;

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const VisitChangeSchema = z.object({ circleId: z.string().uuid(), id: z.string().uuid() }).strict();

/** The caregiver's fix to a saved visit's notes. */
export const VisitUpdateSchema = VisitChangeSchema.extend({
  visitDate: date.optional().or(z.literal("").transform(() => undefined)),
  content: VisitContentSchema,
}).strict();
export type VisitUpdateInput = z.infer<typeof VisitUpdateSchema>;

/**
 * A visit's notes as one person may see them. Everyone who can read visit notes gets what to watch
 * for and good to know. The summary, the reason and the questions are there only for the caregiver,
 * family and care managers (visits:read:summary); for anyone else they are absent, not blank.
 */
export type VisitView = {
  id: string;
  visitDate: string | null;
  createdAt: string;
  clinic?: string;
  provider?: string;
  watchFor: string[];
  goodToKnow: string[];
  summary?: string;
  reason?: string;
  specialty?: string;
  questions?: string[];
  /** The kept photos of this visit. Only the caregiver sees them. */
  documentId?: string | null;
};

/** Cuts a visit down to what a viewer may see. `full` is visits:read:summary. */
export function viewOfVisit(row: { id: string; visitDate: string | null; createdAt: string; content: VisitContent }, full: boolean): VisitView {
  const { content } = row;
  return {
    id: row.id,
    visitDate: row.visitDate,
    createdAt: row.createdAt,
    ...(content.clinic ? { clinic: content.clinic } : {}),
    ...(content.provider ? { provider: content.provider } : {}),
    watchFor: content.watchFor,
    goodToKnow: content.goodToKnow,
    ...(full
      ? {
          summary: content.summary,
          questions: content.questions,
          ...(content.reason ? { reason: content.reason } : {}),
          ...(content.specialty ? { specialty: content.specialty } : {}),
        }
      : {}),
  };
}

/** True when there is something to show this viewer. */
export function hasNotes(visit: VisitView): boolean {
  return visit.watchFor.length > 0 || visit.goodToKnow.length > 0 || !!visit.summary || (visit.questions?.length ?? 0) > 0;
}

/** The day the visit happened, or the day it was saved when the summary gave no date. */
export function visitDay(visit: Pick<VisitView, "visitDate" | "createdAt">): string {
  return visit.visitDate ?? visit.createdAt.slice(0, 10);
}

/** "Nov 4 visit · Maplewood Family Clinic" */
export function visitLabel(visit: Pick<VisitView, "visitDate" | "createdAt" | "clinic" | "provider">): string {
  const day = new Date(`${visitDay(visit)}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  return [`${day} visit`, visit.clinic ?? visit.provider].filter(Boolean).join(" · ");
}

/** Newest visit first: by the day it happened, then by when it was saved. */
export function sortVisits<T extends Pick<VisitView, "visitDate" | "createdAt">>(visits: T[]): T[] {
  return [...visits].sort((a, b) => visitDay(b).localeCompare(visitDay(a)) || b.createdAt.localeCompare(a.createdAt));
}

/** Trims the review draft's lists to what a visit keeps: no blanks, no repeats, at most MAX_VISIT_LINES. */
export function visitLines(lines: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of lines) {
    const value = raw.trim().slice(0, 1000);
    const key = value.toLowerCase();
    if (!value || seen.has(key)) continue;
    seen.add(key);
    out.push(value);
    if (out.length === MAX_VISIT_LINES) break;
  }
  return out;
}
