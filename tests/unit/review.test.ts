import { describe, expect, test } from "vitest";
import { canAcceptMed, medNeedsLook, reviewComplete, reviewState, taskNeedsLook, waitingText } from "@/lib/review";
import type { MedicationChange, Task } from "@/lib/schema";

const med = (over: Partial<MedicationChange> = {}): MedicationChange => ({ id: "m1", kind: "new", name: "Lisinopril", detail: "20 mg once daily", confidence: "high", ...over });
const task = (over: Partial<Task> = {}): Task => ({ id: "t1", title: "Call the clinic", category: "home", confidence: "high", ...over });
const draft = (medications: MedicationChange[], tasks: Task[] = []) => ({ medications, tasks });

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

  test("the medicines cannot be confirmed while one still needs a look", () => {
    const flagged = draft([med(), med({ id: "m2", confidence: "low", unreadable: ["dose"] })]);
    // Even if the confirm was somehow recorded, it does not count.
    expect(reviewState(flagged, { medications: true })).toMatchObject({ medsWaiting: 1, medsDone: false, step: "medications" });
    expect(reviewComplete(flagged, { medications: true, rest: true })).toBe(false);
  });

  test("accepting, fixing or deleting the flagged medicine opens the confirm", () => {
    const accepted = draft([med(), med({ id: "m2", confidence: "high" })]);
    expect(reviewState(accepted, {})).toMatchObject({ medsWaiting: 0, medsDone: false, step: "medications" });
    expect(reviewState(accepted, { medications: true })).toMatchObject({ medsDone: true, step: "rest" });
    const deleted = draft([med()]);
    expect(reviewState(deleted, { medications: true }).step).toBe("rest");
  });

  test("two confirms, in order: the medicines, then everything else", () => {
    const clean = draft([med()], [task()]);
    expect(reviewState(clean, {}).step).toBe("medications");
    // The second confirm alone is not enough.
    expect(reviewState(clean, { rest: true })).toMatchObject({ restDone: false, step: "medications" });
    expect(reviewState(clean, { medications: true }).step).toBe("rest");
    expect(reviewState(clean, { medications: true, rest: true })).toMatchObject({ medsDone: true, restDone: true, step: "done" });
    expect(reviewComplete(clean, { medications: true, rest: true })).toBe(true);
  });

  test("a visit with no medicines still takes both confirms", () => {
    const none = draft([]);
    expect(reviewComplete(none, {})).toBe(false);
    expect(reviewComplete(none, { medications: true, rest: true })).toBe(true);
  });

  test("a next step the reader was unsure of holds the second confirm", () => {
    const unsure = draft([med()], [task({ confidence: "low" })]);
    expect(taskNeedsLook(unsure.tasks[0])).toBe(true);
    expect(reviewState(unsure, { medications: true, rest: true })).toMatchObject({ tasksWaiting: 1, restDone: false, step: "rest" });
  });

  test("a medicine that turns up flagged after the confirm takes the confirm back", () => {
    const later = draft([med(), med({ id: "m3", name: "", origin: "caregiver" })]);
    expect(reviewState(later, { medications: true, rest: true }).step).toBe("medications");
  });

  test("no draft, nothing to save", () => {
    expect(reviewComplete(null, { medications: true, rest: true })).toBe(false);
  });

  test("says how many are waiting in plain words", () => {
    expect(waitingText(1, "medicine", "medicines")).toBe("1 medicine still needs a look");
    expect(waitingText(2, "medicine", "medicines")).toBe("2 medicines still need a look");
  });
});
