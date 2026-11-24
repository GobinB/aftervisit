import { describe, expect, test } from "vitest";
import { SEE_PRESETS } from "@/lib/share-message";
import { circleOf, firstName, seenSentence, seenText, whatTheySee } from "@/lib/what-you-see";
import { addWelcomed, readWelcomed } from "@/lib/welcome";

const calendarOnly = [...SEE_PRESETS.find((preset) => preset.key === "calendar")!.hidden];

describe("what a person in the circle can see", () => {
  test("family on Everything sees every ready part", () => {
    expect(whatTheySee("family", {})).toEqual(["the calendar", "reminders", "medications", "the care summary", "visit notes"]);
  });

  test("Calendar and reminders only is just that", () => {
    expect(seenText(whatTheySee("family", { hidden: calendarOnly }))).toBe("the calendar and reminders");
    expect(seenText(whatTheySee("care_manager", { hidden: calendarOnly }))).toBe("the calendar and reminders");
  });

  test("a home aide or day program sees only their own reminders, even on Everything", () => {
    expect(whatTheySee("home_aide", {})).toEqual(["the calendar", "your own reminders", "medications", "the care summary", "visit notes"]);
    expect(whatTheySee("day_program", { hidden: calendarOnly }, "they")).toEqual(["the calendar", "their own reminders"]);
  });

  test("hiding parts takes them off, and nothing left reads plainly", () => {
    expect(whatTheySee("family", { hidden: ["calendar", "tasks"] })).toEqual(["medications", "the care summary", "visit notes"]);
    expect(seenText(whatTheySee("family", { hidden: ["calendar", "tasks", "medications", "summary", "handoff"] }))).toBe("nothing yet");
  });

  test("lists read as a sentence", () => {
    expect(seenText(["the calendar"])).toBe("the calendar");
    expect(seenText(["the calendar", "reminders", "medications"])).toBe("the calendar, reminders and medications");
    expect(seenSentence(["the calendar", "reminders"])).toBe("The calendar and reminders");
    expect(firstName("  Lena Ortiz ")).toBe("Lena");
    expect(circleOf("Teodora Ruiz")).toBe("Teodora Ruiz's circle");
  });
});

describe("the first-open welcome cookie", () => {
  const a = "11111111-1111-4111-8111-111111111111";
  const b = "22222222-2222-4222-8222-222222222222";

  test("keeps member ids only, once each", () => {
    expect(readWelcomed(undefined)).toEqual([]);
    expect(readWelcomed(`${a}.not-an-id.${b}`)).toEqual([a, b]);
    expect(addWelcomed(addWelcomed(undefined, a), a)).toBe(a);
    expect(addWelcomed(a, b)).toBe(`${a}.${b}`);
  });

  test("keeps the newest twenty", () => {
    const ids = Array.from({ length: 25 }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`);
    const value = ids.reduce<string | undefined>((all, id) => addWelcomed(all, id), undefined);
    expect(readWelcomed(value)).toEqual(ids.slice(-20));
  });
});
