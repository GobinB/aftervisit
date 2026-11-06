import { describe, expect, test } from "vitest";
import { parse } from "@/lib/parse";
import { findExplicitDate, findTime, resolveDue } from "@/lib/parse/dates";
import { TaskSchema } from "@/lib/schema";

const VISIT = "2026-11-04";

describe("resolveDue: explicit dates", () => {
  test.each([
    ["11/20/2026", undefined, "2026-11-20"],
    ["11/20/26", undefined, "2026-11-20"],
    ["2026-11-20", undefined, "2026-11-20"],
    ["December 1, 2026", undefined, "2026-12-01"],
    ["Tuesday, December 1, 2026", undefined, "2026-12-01"],
    ["Dec. 1st, 2026", undefined, "2026-12-01"],
    ["20 November 2026", undefined, "2026-11-20"],
    // Explicit dates do not need the visit date, and ignore it.
    ["on 11/20/2026", VISIT, "2026-11-20"],
  ])("%s -> %s", (text, visit, date) => {
    expect(resolveDue(text, visit)).toEqual({ date });
  });

  test("a date without a year takes the visit year, or the next one when it would fall before the visit", () => {
    expect(resolveDue("Nov 20", VISIT)).toEqual({ date: "2026-11-20" });
    expect(resolveDue("Tuesday, December 1", VISIT)).toEqual({ date: "2026-12-01" });
    expect(resolveDue("by 11/14", VISIT)).toEqual({ date: "2026-11-14" });
    expect(resolveDue("Jan 5", VISIT)).toEqual({ date: "2027-01-05" });
    expect(resolveDue("Nov 4", VISIT)).toEqual({ date: "2026-11-04" });
  });

  test("a date without a year and no visit date is unknown", () => {
    expect(resolveDue("Nov 20")).toBeNull();
    expect(resolveDue("Tuesday, December 1")).toBeNull();
  });

  test("impossible dates and non-dates are null", () => {
    expect(resolveDue("13/45/2026")).toBeNull();
    expect(resolveDue("Feb 30, 2026")).toBeNull();
    expect(resolveDue("Take 1/2 tablet", VISIT)).toBeNull();
    expect(resolveDue("every morning", VISIT)).toBeNull();
    expect(resolveDue("", VISIT)).toBeNull();
    expect(resolveDue("decreased 5 mg", VISIT)).toBeNull();
  });
});

describe("resolveDue: relative phrases", () => {
  test.each([
    ["in 2 weeks", "2026-11-18"],
    ["within 3 months", "2027-02-04"],
    ["in 10 days", "2026-11-14"],
    ["in one week", "2026-11-11"],
    ["within the next 6 weeks", "2026-12-16"],
    ["in 1-2 weeks", "2026-11-18"],
    ["Follow up with your primary care provider in 5-7 days", "2026-11-11"],
    ["in a month", "2026-12-04"],
    ["in 1 year", "2027-11-04"],
    ["tomorrow", "2026-11-05"],
    ["next week", "2026-11-11"],
  ])("%s -> %s", (text, date) => {
    expect(resolveDue(text, VISIT)).toEqual({ date });
  });

  test("month arithmetic clamps to the end of the month", () => {
    expect(resolveDue("in 1 month", "2026-01-31")).toEqual({ date: "2026-02-28" });
  });

  test("relative phrases need a visit date", () => {
    expect(resolveDue("in 2 weeks")).toBeNull();
    expect(resolveDue("within 3 months")).toBeNull();
  });
});

describe("resolveDue: times", () => {
  test.each([
    ["11/20/2026 at 10:30 AM", "10:30"],
    ["Nov 20, 2026 9:15am", "09:15"],
    ["11/20/2026 14:00", "14:00"],
    ["11/20/2026 at 2 PM", "14:00"],
    ["11/20/2026 at 2:00 p.m.", "14:00"],
    ["11/20/2026 12:30 PM", "12:30"],
    ["11/20/2026 12:00 AM", "00:00"],
    ["11/20/2026 at noon", "12:00"],
  ])("%s -> %s", (text, time) => {
    expect(resolveDue(text, VISIT)?.time).toBe(time);
  });

  test("a time is only returned with a date", () => {
    expect(resolveDue("at 10:30 AM", VISIT)).toBeNull();
    expect(resolveDue("in 2 weeks at 9 AM", VISIT)).toEqual({ date: "2026-11-18", time: "09:00" });
  });

  test("no time when none is stated", () => {
    expect(resolveDue("11/20/2026")).toEqual({ date: "2026-11-20" });
  });

  test("helpers report positions", () => {
    const text = "See Dr. Lee on Tuesday, December 1, 2026 at 9:15 AM.";
    const d = findExplicitDate(text)!;
    expect(text.slice(d.index, d.end)).toBe("Tuesday, December 1, 2026");
    const t = findTime(text)!;
    expect(text.slice(t.index, t.end)).toBe("9:15 AM");
  });
});

describe("TaskSchema.dueTime", () => {
  const base = { id: "task_1", title: "Cardiology appointment", category: "appointment", confidence: "high" } as const;
  test("accepts HH:MM and leaves it optional", () => {
    expect(TaskSchema.safeParse({ ...base, dueDate: "2026-12-01", dueTime: "09:15" }).success).toBe(true);
    expect(TaskSchema.safeParse(base).success).toBe(true);
  });
  test("rejects other shapes", () => {
    expect(TaskSchema.safeParse({ ...base, dueTime: "9:15" }).success).toBe(false);
    expect(TaskSchema.safeParse({ ...base, dueTime: "9:15 AM" }).success).toBe(false);
  });
});

describe("parser due dates", () => {
  const task = (text: string) => parse({ text }).tasks[0];

  test("an explicit date and time move from the title into dueDate / dueTime", () => {
    const t = task("Visit date: 11/04/2026\nFollow up with Dr. Natarajan on 11/20/2026 at 10:30 AM");
    expect(t).toMatchObject({
      title: "Follow up with Dr. Natarajan",
      category: "appointment",
      dueText: "on 11/20/2026 at 10:30 AM",
      dueDate: "2026-11-20",
      dueTime: "10:30",
    });
  });

  test("relative phrases stay in dueText only", () => {
    const t = task("Visit date: 11/04/2026\nReturn to clinic in 2 weeks");
    expect(t).toMatchObject({ title: "Return to clinic", category: "appointment", dueText: "in 2 weeks" });
    expect(t.dueDate).toBeUndefined();
    expect(t.dueTime).toBeUndefined();
  });

  test("a date without a year uses the visit year, and stays undated when the visit date is unknown", () => {
    expect(task("Visit date: 11/04/2026\nFollow up on Nov 20 with Dr. Lee.").dueDate).toBe("2026-11-20");
    const undated = task("Follow up on Nov 20 with Dr. Lee.");
    expect(undated.dueText).toBe("on Nov 20");
    expect(undated.dueDate).toBeUndefined();
  });

  test("an inline next-appointment line becomes a titled appointment", () => {
    const t = task("Your next appointment: Tuesday, December 1, 2026 9:15 AM Cardiology – Dr. Lee");
    expect(t).toMatchObject({
      title: "Cardiology appointment with Dr. Lee",
      category: "appointment",
      dueDate: "2026-12-01",
      dueTime: "09:15",
      sourceQuote: "Your next appointment: Tuesday, December 1, 2026 9:15 AM Cardiology – Dr. Lee",
    });
  });

  test("Upcoming appointments: one task per entry, with or without blank lines between them", () => {
    const text = [
      "Visit date: 11/04/2026",
      "",
      "Upcoming Appointments",
      "Nov 20 10:30 AM Cardiology - Dr. Lee",
      "Dec 3 8:00 AM Lab draw - Maplewood Lab",
      "Pulmonology - Aisha Rahman, MD",
      "Date: 01/12/2027   Time: 1:00 PM",
      "Location: Cedar Ridge Pulmonary Clinic",
    ].join("\n");
    const d = parse({ text });
    expect(d.tasks.map((t) => [t.title, t.category, t.dueDate, t.dueTime])).toEqual([
      ["Cardiology appointment with Dr. Lee", "appointment", "2026-11-20", "10:30"],
      ["Lab draw at Maplewood Lab", "appointment", "2026-12-03", "08:00"],
      ["Pulmonology appointment with Dr. Aisha Rahman at Cedar Ridge Pulmonary Clinic", "appointment", "2027-01-12", "13:00"],
    ]);
    // The entries' "Date:" line never becomes the visit date.
    expect(d.visit.date).toBe("2026-11-04");
    expect(d.otherNotes).toEqual([]);
  });

  test("an appointment section sentence is still an ordinary task", () => {
    const d = parse({ text: "Follow-up Appointments\nFollow up with your primary care provider within 7 days." });
    expect(d.tasks).toHaveLength(1);
    expect(d.tasks[0]).toMatchObject({ category: "appointment", dueText: "within 7 days" });
    expect(d.tasks[0].dueDate).toBeUndefined();
  });

  test("'after' a date is not a due date", () => {
    const t = task("Visit date: 11/04/2026\nStart walking again after 11/20/2026.");
    expect(t.dueDate).toBeUndefined();
  });
});
