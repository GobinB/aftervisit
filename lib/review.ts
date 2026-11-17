import type { HandoffDraft, MedicationChange, Task } from "./schema";

/**
 * The rules of the review screen, in one place. Three sections carry an "I reviewed it" button: the
 * medicines (always), the next steps and what to watch for (when they have something). Continue opens
 * once those are reviewed. A section cannot be marked reviewed while an item in it the reader was
 * unsure of is still waiting to be looked at. Nothing is saved or shared until then; the pages that
 * save check again.
 */
export const REVIEW_SECTIONS = ["medications", "visit", "tasks", "watchFor", "otherNotes", "questions"] as const;
export type ReviewSection = (typeof REVIEW_SECTIONS)[number];
export type Reviewed = Partial<Record<ReviewSection, boolean>>;

/**
 * A medicine the caregiver must look at before the medicines can be ticked: the reader could not
 * read part of it (it is marked low confidence), or it has no name. Looking at it means accepting it,
 * fixing it or deleting it.
 */
export function medNeedsLook(med: Pick<MedicationChange, "confidence" | "name">): boolean {
  return med.confidence === "low" || !med.name.trim();
}

/** A medicine with no name can be fixed or deleted, never accepted as it is. */
export function canAcceptMed(med: Pick<MedicationChange, "name">): boolean {
  return med.name.trim().length > 0;
}

/** A next step the caregiver must look at before the next steps can be ticked. */
export function taskNeedsLook(task: Pick<Task, "confidence">): boolean {
  return task.confidence === "low";
}

type ReviewDraft = Pick<HandoffDraft, "medications" | "tasks" | "watchFor" | "otherNotes" | "questions">;

/** The sections with an "I reviewed it" button, in page order. */
export const REVIEWED_SECTIONS = ["medications", "tasks", "watchFor"] as const satisfies readonly ReviewSection[];

/**
 * The sections that must be reviewed. The medicines always: an empty medicines list is exactly what
 * the caregiver must notice if the reader missed one. Next steps and Watch for when they have items.
 */
export function sectionsToCheck(draft: ReviewDraft): ReviewSection[] {
  return REVIEWED_SECTIONS.filter((section) => section === "medications" || draft[section].length > 0);
}

export interface ReviewState {
  /** Medicines still waiting for a look. The medicines cannot be ticked while this is above zero. */
  medsWaiting: number;
  /** Next steps still waiting for a look. The next steps cannot be ticked while this is above zero. */
  tasksWaiting: number;
  /** The sections that need a tick, in page order. */
  sections: ReviewSection[];
  /** Ticked, and nothing in it is waiting. A tick given earlier stops counting the moment something new needs a look. */
  done: Record<ReviewSection, boolean>;
  /** Why a section cannot be ticked yet ("1 medicine still needs a look"), when it cannot. */
  blocked: Partial<Record<ReviewSection, string>>;
  doneCount: number;
  complete: boolean;
}

/** "1 medicine still needs a look", for a tick that is switched off. */
export function waitingText(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many} still ${count === 1 ? "needs" : "need"} a look`;
}

export function reviewState(draft: ReviewDraft, reviewed: Reviewed): ReviewState {
  const medsWaiting = draft.medications.filter(medNeedsLook).length;
  const tasksWaiting = draft.tasks.filter(taskNeedsLook).length;
  const blocked: ReviewState["blocked"] = {};
  if (medsWaiting) blocked.medications = waitingText(medsWaiting, "medicine", "medicines");
  if (tasksWaiting) blocked.tasks = waitingText(tasksWaiting, "next step", "next steps");
  const sections = sectionsToCheck(draft);
  const done = Object.fromEntries(REVIEW_SECTIONS.map((section) => [section, !!reviewed[section] && !blocked[section] && sections.includes(section)])) as Record<
    ReviewSection,
    boolean
  >;
  const doneCount = sections.filter((section) => done[section]).length;
  return { medsWaiting, tasksWaiting, sections, done, blocked, doneCount, complete: doneCount === sections.length };
}

/** True when the draft may go on to be saved or shared. Checked again on the pages that save. */
export function reviewComplete(draft: ReviewDraft | null, reviewed: Reviewed): boolean {
  return !!draft && reviewState(draft, reviewed).complete;
}

/** The ids of the items still waiting for a look, medicines first, so the button can take the caregiver to the next one. */
export function itemsWaiting(draft: Pick<HandoffDraft, "medications" | "tasks">): string[] {
  return [...draft.medications.filter(medNeedsLook).map((med) => med.id), ...draft.tasks.filter(taskNeedsLook).map((task) => task.id)];
}
