import { beforeEach, describe, expect, test, vi } from "vitest";
import type { Actor } from "@/lib/auth";
import { MedicationInputSchema, clockTime, doseText, scheduleText } from "@/lib/schema/medications";

const { clientFor } = vi.hoisted(() => ({ clientFor: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/store/db", () => ({ clientFor }));

import { listMedications, saveMedication, setMedicationStatus } from "@/services/medications";

const circleId = "22222222-2222-4222-8222-222222222222";
const owner: Actor = { kind: "caregiver", userId: "user-owner", circleIds: [circleId], role: "owner", accessToken: "token" };
const aide: Actor = { kind: "helper", memberId: "33333333-3333-4333-8333-333333333301", circleId, role: "home_aide", visibility: {} };
const hidden: Actor = { kind: "helper", memberId: "33333333-3333-4333-8333-333333333302", circleId, role: "family", visibility: { hidden: ["medications"] } };

beforeEach(() => clientFor.mockReset());

describe("medication wording", () => {
  test("times read like a clock", () => {
    expect(clockTime("08:00")).toBe("8 AM");
    expect(clockTime("20:30")).toBe("8:30 PM");
    expect(clockTime("00:00")).toBe("12 AM");
    expect(clockTime("12:15")).toBe("12:15 PM");
  });

  test("schedules read in plain words", () => {
    expect(scheduleText({ schedule: "daily", every: null, weekdays: [], times: ["20:00", "08:00"] })).toBe("Every day at 8 AM and 8 PM");
    expect(scheduleText({ schedule: "as_needed", every: null, weekdays: [], times: ["08:00"] })).toBe("Only when needed");
    expect(scheduleText({ schedule: "weekdays", every: null, weekdays: [5, 1, 3], times: [] })).toBe("Mon, Wed and Fri");
    expect(scheduleText({ schedule: "every_x_days", every: 2, weekdays: [], times: ["09:00"] })).toBe("Every 2 days at 9 AM");
    expect(scheduleText({ schedule: "every_x_months", every: 1, weekdays: [], times: [] })).toBe("Every month");
  });

  test("dose shows strength and amount, or the form", () => {
    expect(doseText({ dose: "10 mg", amount: "1 tablet", form: "tablet" })).toBe("10 mg · 1 tablet");
    expect(doseText({ dose: "5 ml", amount: null, form: "liquid" })).toBe("5 ml · Liquid");
    expect(doseText({ dose: null, amount: null, form: null })).toBe("");
  });
});

describe("medication input", () => {
  const base = { circleId, name: "Lisinopril", schedule: "daily" as const };

  test("only the name is needed", () => {
    expect(MedicationInputSchema.safeParse(base).success).toBe(true);
    expect(MedicationInputSchema.safeParse({ ...base, name: "  " }).success).toBe(false);
  });

  test("repeating schedules need how often, weekday schedules need a day", () => {
    expect(MedicationInputSchema.safeParse({ ...base, schedule: "every_x_days" }).success).toBe(false);
    expect(MedicationInputSchema.safeParse({ ...base, schedule: "every_x_days", every: 3 }).success).toBe(true);
    expect(MedicationInputSchema.safeParse({ ...base, schedule: "weekdays" }).success).toBe(false);
    expect(MedicationInputSchema.safeParse({ ...base, schedule: "weekdays", weekdays: [1] }).success).toBe(true);
  });

  test("times are HH:MM and unknown fields are refused", () => {
    expect(MedicationInputSchema.safeParse({ ...base, times: ["8am"] }).success).toBe(false);
    expect(MedicationInputSchema.safeParse({ ...base, times: ["24:00"] }).success).toBe(false);
    expect(MedicationInputSchema.safeParse({ ...base, status: "stopped" }).success).toBe(false);
  });
});

describe("medication permissions", () => {
  test("a helper cannot add or stop a medication, and nothing reaches the database", async () => {
    const input = MedicationInputSchema.parse({ circleId, name: "Lisinopril", schedule: "daily" });
    expect((await saveMedication(aide, input)).ok).toBe(false);
    expect((await setMedicationStatus(aide, circleId, "44444444-4444-4444-8444-444444444444", "stopped")).ok).toBe(false);
    expect(clientFor).not.toHaveBeenCalled();
  });

  test("a helper with medications hidden gets no list", async () => {
    expect(await listMedications(hidden, circleId)).toBeNull();
    expect(clientFor).not.toHaveBeenCalled();
  });

  test("the owner's new medication goes to their circle", async () => {
    const insert = vi.fn(() => ({ select: () => ({ single: async () => ({ data: { id: "m1" }, error: null }) }) }));
    clientFor.mockReturnValue({ from: () => ({ insert }) });
    const input = MedicationInputSchema.parse({ circleId, name: "Lisinopril", schedule: "as_needed", times: ["08:00"] });
    expect(await saveMedication(owner, input)).toEqual({ ok: true, id: "m1" });
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ circle_id: circleId, name: "Lisinopril", times: [] }));
  });
});
