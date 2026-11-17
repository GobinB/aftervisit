import { describe, expect, test } from "vitest";
import { canAcceptMed, confirmAll, itemsWaiting, medNeedsLook, reviewComplete, reviewState, sectionsToCheck, taskNeedsLook, waitingText, type Reviewed } from "@/lib/review";
import type { MedicationChange, Task } from "@/lib/schema";

const med = (over: Partial<MedicationChange> = {}): MedicationChange => ({ id: "m1", kind: "new", name: "Lisinopril", detail: "20 mg once daily", confidence: "high", ...over });
const task = (over: Partial<Task> = {}): Task => ({ id: "t1", title: "Call the clinic", category: "home", confidence: "high", ...over });
const draft = (medications: MedicationChange[], tasks: Task[] = [], lists: { watchFor?: string[]; otherNotes?: string[]; questions?: string[] } = {}) => ({
  medications,
  tasks,
  watchFor: lists.watchFor ?? [],
  otherNotes: lists.otherNotes ?? [],
  questions: lists.questions ?? [],
});
const all: Reviewed = { medications: true, visit: true, tasks: true, watchFor: true, otherNotes: true, questions: true };

describe("the review rule", () => {
  test("a medicine the reader was unsure of must be looked at, and so must one with no name", () => {
    expect(medNeedsLook(med())).toBe(false);
    expect(medNeedsLook(med({ confidence: "low" }))).toBe(true);
    expect(medNeedsLook(med({ confidence: "low", unreadable: ["dose"], detail: "" }))).toBe(true);
    // A blank name is never fine, even if nothing marked it.
    expect(medNeedsLook(med({ name: "  ", confidence: "high" }))).toBe(true);
  });

  test("a medicine with no name cannot be accepted as it is", () => {
    expect(canAcceptMed(med())).toBe(true);
    expect(canAcceptMed(med({ name: "" }))).toBe(false);
    expect(canAcceptMed(med({ name: "   " }))).toBe(false);
  });

  test("each section with something in it gets a check mark; the medicines and the visit always do", () => {
    expect(sectionsToCheck(draft([]))).toEqual(["medications", "visit"]);
    expect(sectionsToCheck(draft([med()], [task()], { watchFor: ["Fever"], otherNotes: ["No caffeine"], questions: ["Why?"] }))).toEqual([
      "medications",
      "visit",
      "tasks",
      "watchFor",
      "otherNotes",
      "questions",
    ]);
    // Empty lists need no tick.
    expect(sectionsToCheck(draft([med()], [], { watchFor: ["Fever"] }))).toEqual(["medications", "visit", "watchFor"]);
  });

  test("the medicines cannot be ticked while one still needs a look", () => {
    const flagged = draft([med(), med({ id: "m2", confidence: "low", unreadable: ["dose"] })]);
    const state = reviewState(flagged, all);
    // Even if the tick was somehow recorded, it does not count.
    expect(state).toMatchObject({ medsWaiting: 1, complete: false });
    expect(state.done.medications).toBe(false);
    expect(state.blocked.medications).toBe("1 medicine still needs a look");
    expect(reviewComplete(flagged, all)).toBe(false);
  });

  test("accepting, fixing or deleting the flagged medicine lets the medicines be ticked", () => {
    const accepted = draft([med(), med({ id: "m2", confidence: "high" })]);
    expect(reviewState(accepted, {}).blocked.medications).toBeUndefined();
    expect(reviewState(accepted, { medications: true }).done.medications).toBe(true);
  });

  test("every section that needs a tick must have one, in any order", () => {
    const clean = draft([med()], [task()], { watchFor: ["Fever"] });
    expect(reviewState(clean, {})).toMatchObject({ doneCount: 0, complete: false });
    expect(reviewState(clean, { tasks: true, watchFor: true })).toMatchObject({ doneCount: 2, complete: false });
    expect(reviewState(clean, { medications: true, visit: true, tasks: true })).toMatchObject({ doneCount: 3, complete: false });
    expect(reviewState(clean, { medications: true, visit: true, tasks: true, watchFor: true })).toMatchObject({ doneCount: 4, complete: true });
    // A tick on a section that has nothing in it does not count towards the total.
    expect(reviewState(clean, { questions: true }).doneCount).toBe(0);
  });

  test("a visit with no medicines still needs the medicines ticked, so an empty list is noticed", () => {
    const none = draft([]);
    expect(reviewComplete(none, { visit: true })).toBe(false);
    expect(reviewComplete(none, { medications: true, visit: true })).toBe(true);
  });

  test("a next step the reader was unsure of holds the next steps' tick", () => {
    const unsure = draft([med()], [task({ confidence: "low" })]);
    expect(taskNeedsLook(unsure.tasks[0])).toBe(true);
    const state = reviewState(unsure, all);
    expect(state).toMatchObject({ tasksWaiting: 1, complete: false });
    expect(state.done.tasks).toBe(false);
    expect(state.blocked.tasks).toBe("1 next step still needs a look");
  });

  test("a medicine that turns up flagged after the tick takes the tick back", () => {
    const later = draft([med(), med({ id: "m3", name: "", origin: "caregiver" })]);
    expect(reviewState(later, all).done.medications).toBe(false);
    expect(reviewComplete(later, all)).toBe(false);
  });

  test("no draft, nothing to save", () => {
    expect(reviewComplete(null, all)).toBe(false);
  });

  test("says how many are waiting in plain words", () => {
    expect(waitingText(1, "medicine", "medicines")).toBe("1 medicine still needs a look");
    expect(waitingText(2, "medicine", "medicines")).toBe("2 medicines still need a look");
  });
});

describe("one confirm on Review", () => {
  test("Looks right marks every section, so the pages that save let it through", () => {
    const d = draft([med()], [task()], { watchFor: ["Fever"] });
    expect(reviewComplete(d, confirmAll())).toBe(true);
    expect(reviewComplete(d, {})).toBe(false);
  });

  test("it still does not count while something needs a look", () => {
    const d = draft([med({ confidence: "low" })], [task()]);
    expect(reviewComplete(d, confirmAll())).toBe(false);
  });

  test("the button goes to what needs a look, medicines first", () => {
    const d = draft([med(), med({ id: "m2", name: "" })], [task({ id: "t2", confidence: "low" }), task()]);
    expect(itemsWaiting(d)).toEqual(["m2", "t2"]);
    expect(itemsWaiting(draft([med()], [task()]))).toEqual([]);
  });
});
