import { describe, expect, it } from "vitest";
import { medsByTime, medsOnDay } from "@/lib/med-days";
import type { Medication } from "@/lib/schema/medications";

const med = (over: Partial<Medication>): Medication => ({
  id: over.name ?? "m",
  name: "Lisinopril",
  dose: "10 mg",
  amount: "1 tablet",
  form: null,
  schedule: "daily",
  every: null,
  weekdays: [],
  times: ["08:00"],
  startDate: null,
  stopDate: null,
  status: "active",
  reason: null,
  instructions: null,
  prescriber: null,
  refillsLeft: null,
  lastRefill: null,
  source: "caregiver",
  updatedAt: "2026-11-01T10:00:00Z",
  ...over,
});

describe("medicines by day", () => {
  it("lists daily medicines with their dose and times, earliest first", () => {
    const list = medsOnDay([med({ name: "Metformin", dose: "500 mg", times: ["20:00", "08:00"] }), med({ name: "Lisinopril", times: ["07:00"] })], "2026-11-10");
    expect(list.map((m) => m.name)).toEqual(["Lisinopril", "Metformin"]);
    expect(list[1].dose).toBe("500 mg · 1 tablet");
    expect(list[1].times).toEqual(["08:00", "20:00"]);
  });

  it("leaves out as-needed medicines, and days before the start or after the stop", () => {
    const meds = [
      med({ name: "Tylenol", schedule: "as_needed", times: [] }),
      med({ name: "New", startDate: "2026-11-12" }),
      med({ name: "Old", status: "stopped", stopDate: "2026-11-05" }),
    ];
    expect(medsOnDay(meds, "2026-11-04").map((m) => m.name)).toEqual(["Old"]);
    expect(medsOnDay(meds, "2026-11-10").map((m) => m.name)).toEqual([]);
    expect(medsOnDay(meds, "2026-11-12").map((m) => m.name)).toEqual(["New"]);
  });

  it("follows weekday, every-few-days, weekly and monthly schedules", () => {
    // 2026-11-02 is a Monday.
    const meds = [
      med({ name: "MWF", schedule: "weekdays", weekdays: [1, 3, 5] }),
      med({ name: "Every3", schedule: "every_x_days", every: 3, startDate: "2026-11-01" }),
      med({ name: "Weekly", schedule: "every_x_weeks", every: 1, startDate: "2026-11-02" }),
      med({ name: "Monthly", schedule: "every_x_months", every: 1, startDate: "2026-10-02" }),
    ];
    expect(medsOnDay(meds, "2026-11-02").map((m) => m.name).sort()).toEqual(["MWF", "Monthly", "Weekly"]);
    expect(medsOnDay(meds, "2026-11-04").map((m) => m.name).sort()).toEqual(["Every3", "MWF"]);
    expect(medsOnDay(meds, "2026-11-09").map((m) => m.name).sort()).toEqual(["MWF", "Weekly"]);
  });

  it("groups a day's medicines by time", () => {
    const slots = medsByTime(medsOnDay([med({ name: "A", times: ["08:00", "20:00"] }), med({ name: "B", times: [] })], "2026-11-10"));
    expect(slots.map((s) => s.label)).toEqual(["8 AM", "8 PM", "Any time"]);
    expect(slots[0].meds.map((m) => m.name)).toEqual(["A"]);
  });
});
