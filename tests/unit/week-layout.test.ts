import { describe, expect, it } from "vitest";
import type { CalendarItem } from "@/lib/calendar-rows";
import { buildWeek, placeLanes, weekDays, weekStart, weekText } from "@/lib/week-layout";

const item = (over: Partial<CalendarItem>): CalendarItem => ({
  key: over.id ?? "e",
  kind: "event",
  id: "e",
  date: "2026-11-17",
  title: "Physical therapy",
  time: "9 AM to 10 AM",
  sortTime: "09:00",
  startTime: "09:00",
  endTime: "10:00",
  location: null,
  notes: null,
  who: null,
  needsSomeone: false,
  canGo: false,
  repeats: false,
  ...over,
});

const BASE = "/circles/c1/calendar";

describe("week view", () => {
  it("weeks run Sunday to Saturday", () => {
    expect(weekStart("2026-11-18")).toBe("2026-11-15");
    expect(weekStart("2026-11-15")).toBe("2026-11-15");
    expect(weekDays("2026-11-15")).toHaveLength(7);
    expect(weekText("2026-11-15")).toBe("Nov 15 – 21, 2026");
    expect(weekText("2026-10-25")).toBe("Oct 25 – 31, 2026");
    expect(weekText("2026-11-29")).toBe("Nov 29 – Dec 5, 2026");
  });

  it("places blocks by time and colours them by kind", () => {
    const week = buildWeek({
      start: "2026-11-15",
      base: BASE,
      canEdit: true,
      items: [
        item({ id: "pt", key: "pt" }),
        item({ id: "card", key: "card", title: "Cardiology", startTime: "10:30", endTime: null, time: "10:30 AM", needsSomeone: true }),
        item({ id: "bday", key: "bday", title: "Birthday", startTime: null, endTime: null, time: "All day", date: "2026-11-18" }),
        item({ id: "rx", key: "rx", kind: "todo", title: "Pick up prescription", startTime: null, endTime: null, time: "Reminder due", date: "2026-11-19" }),
      ],
      meds: { "2026-11-17": [{ id: "m1", name: "Lisinopril", dose: "10 mg", times: ["08:00"] }, { id: "m2", name: "Vitamin D", dose: "", times: [] }] },
    });
    const tue = week.timed["2026-11-17"];
    expect(tue.map((b) => [b.kind, b.start, b.end])).toEqual([
      ["meds", 480, 510],
      ["event", 540, 600],
      ["needs", 630, 690],
    ]);
    expect(tue[1].href).toBe(`${BASE}/pt`);
    expect(tue[0].title).toBe("Lisinopril");
    expect(week.allDay["2026-11-17"]).toMatchObject([{ kind: "meds", title: "Vitamin D" }]);
    expect(week.allDay["2026-11-18"]).toMatchObject([{ kind: "event", title: "Birthday" }]);
    expect(week.allDay["2026-11-19"]).toMatchObject([{ kind: "reminder", href: "/circles/c1/todos" }]);
    expect([week.startHour, week.endHour]).toEqual([7, 20]);
  });

  it("grows the hours to fit an early or late event, and helpers' blocks open the day", () => {
    const week = buildWeek({ start: "2026-11-15", base: BASE, canEdit: false, items: [item({ startTime: "06:15", endTime: "06:45" }), item({ id: "late", startTime: "21:00", endTime: "22:30" })] });
    expect([week.startHour, week.endHour]).toEqual([6, 23]);
    expect(week.timed["2026-11-17"][0].href).toBe(`${BASE}?view=day&date=2026-11-17`);
  });

  it("puts overlapping blocks side by side", () => {
    const base = { kind: "event" as const, date: "d", title: "", detail: "", href: null };
    const placed = placeLanes([
      { ...base, key: "a", start: 540, end: 600 },
      { ...base, key: "b", start: 570, end: 630 },
      { ...base, key: "c", start: 600, end: 660 },
      { ...base, key: "d", start: 720, end: 780 },
    ]);
    const by = Object.fromEntries(placed.map((b) => [b.key, [b.lane, b.lanes]]));
    expect(by).toEqual({ a: [0, 2], b: [1, 2], c: [0, 2], d: [0, 1] });
  });
});
