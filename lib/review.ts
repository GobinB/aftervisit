import type { HandoffDraft, MedicationChange, Task } from "./schema";

/**
 * The rules of the review screen, in one place. Review has two confirms: the medicines, then
 * everything else. Nothing is saved or shared until both are given, and neither can be given while
 * an item the reader was unsure of is still waiting to be looked at.
 */
export const REVIEW_STEPS = ["medications", "rest"] as const;
export type ReviewStep = (typeof REVIEW_STEPS)[number];
export type Reviewed = Partial<Record<ReviewStep, boolean>>;

/**
 * A medicine the caregiver must look at before the medicines can be confirmed: the reader could not
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

/** A next step the caregiver must look at before the rest can be confirmed. */
export function taskNeedsLook(task: Pick<Task, "confidence">): boolean {
  return task.confidence === "low";
}

export interface ReviewState {
  /** Medicines still waiting for a look. The medicines confirm is off while this is above zero. */
  medsWaiting: number;
  /** Next steps still waiting for a look. The second confirm is off while this is above zero. */
  tasksWaiting: number;
  medsDone: boolean;
  restDone: boolean;
  /** The confirm the caregiver is on, or "done" when both are given. */
  step: ReviewStep | "done";
}

export function reviewState(draft: Pick<HandoffDraft, "medications" | "tasks">, reviewed: Reviewed): ReviewState {
  const medsWaiting = draft.medications.filter(medNeedsLook).length;
  const tasksWaiting = draft.tasks.filter(taskNeedsLook).length;
  // A confirm given earlier stops counting the moment something new needs a look.
  const medsDone = !!reviewed.medications && medsWaiting === 0;
  const restDone = medsDone && !!reviewed.rest && tasksWaiting === 0;
  return { medsWaiting, tasksWaiting, medsDone, restDone, step: !medsDone ? "medications" : !restDone ? "rest" : "done" };
}

/** True when the draft may go on to be saved or shared. Checked again on the pages that save. */
export function reviewComplete(draft: Pick<HandoffDraft, "medications" | "tasks"> | null, reviewed: Reviewed): boolean {
  return !!draft && reviewState(draft, reviewed).step === "done";
}

/** "1 medicine still needs a look", for the confirm that is switched off. */
export function waitingText(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many} still ${count === 1 ? "needs" : "need"} a look`;
}
