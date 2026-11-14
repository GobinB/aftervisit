import { describe, expect, test } from "vitest";
import { changedWords, linkExpiry } from "@/lib/link-life";

const DAY = 24 * 60 * 60 * 1000;
const made = new Date("2026-11-14T12:00:00Z");

describe("how long a link keeps working", () => {
  test("a new link works for 30 days if nobody opens it", () => {
    expect(linkExpiry(made, made).getTime() - made.getTime()).toBe(30 * DAY);
  });

  test("each time it is opened it keeps going for another 30 days", () => {
    const opened = new Date(made.getTime() + 20 * DAY);
    expect(linkExpiry(made, opened).getTime()).toBe(opened.getTime() + 30 * DAY);
  });

  test("however often it is opened, it ends 90 days after it was made", () => {
    for (const day of [61, 75, 89, 120]) {
      const opened = new Date(made.getTime() + day * DAY);
      expect(linkExpiry(made, opened).getTime()).toBe(made.getTime() + 90 * DAY);
    }
  });
});

describe("what changed, in words", () => {
  test("lists the areas in a fixed order", () => {
    expect(changedWords(["medications"])).toBe("medicines");
    expect(changedWords(["calendar", "medications"])).toBe("medicines and the calendar");
    expect(changedWords(["summary", "tasks", "medications", "calendar"])).toBe("medicines, the calendar, reminders and the care summary");
    expect(changedWords([])).toBe("");
  });
});
