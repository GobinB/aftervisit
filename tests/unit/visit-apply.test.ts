import { beforeEach, describe, expect, test, vi } from "vitest";
import type { Actor } from "@/lib/auth";
import type { MedicationChange } from "@/lib/schema";
import type { Medication } from "@/lib/schema/medications";
import { ApplyVisitSchema } from "@/lib/schema/visit";
import { findMatch, planMedications, scheduleOf, strengthOf } from "@/lib/visit-apply";

const { clientFor } = vi.hoisted(() => ({ clientFor: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/store/db", () => ({ clientFor }));

import { applyVisit } from "@/services/visits";

const circleId = "22222222-2222-4222-8222-222222222222";
const owner: Actor = { kind: "caregiver", userId: "user-owner", circleIds: [circleId], role: "owner", accessToken: "token" };
const family: Actor = { kind: "helper", memberId: "33333333-3333-4333-8333-333333333301", circleId, role: "family", visibility: {} };

const med = (id: string, name: string, dose: string | null, status: "active" | "stopped" = "active"): Medication => ({
  id,
  name,
  dose,
  amount: null,
  form: null,
  schedule: "daily",
  every: null,
  weekdays: [],
  times: [],
  startDate: null,
  stopDate: null,
  status,
  reason: null,
  instructions: null,
  prescriber: null,
  refillsLeft: null,
  lastRefill: null,
  source: "caregiver",
  updatedAt: "2026-11-01T00:00:00Z",
});
const change = (id: string, kind: MedicationChange["kind"], name: string, detail = ""): MedicationChange => ({ id, kind, name, detail, confidence: "high" });

const list = [med("m-lis", "Lisinopril", "10 mg"), med("m-met", "Metformin ER", "500 mg"), med("m-old", "Atenolol", "25 mg", "stopped")];

beforeEach(() => clientFor.mockReset());

describe("reading a visit", () => {
  test("strength and as-needed come from the clinic's words", () => {
    expect(strengthOf("20 mg once daily (was 10 mg)")).toBe("20 mg");
    expect(strengthOf("5 ML by mouth")).toBe("5 mL");
    expect(strengthOf("1000 iu weekly")).toBe("1000 IU");
    expect(strengthOf("one tablet")).toBeNull();
    expect(scheduleOf("1 tablet every 6 hours as needed for pain")).toBe("as_needed");
    expect(scheduleOf("twice daily")).toBe("daily");
  });

  test("matching ignores case, punctuation and a release suffix, and skips stopped medications", () => {
    expect(findMatch("LISINOPRIL", list)?.id).toBe("m-lis");
    expect(findMatch("metformin", list)?.id).toBe("m-met");
    expect(findMatch("Atenolol", list)).toBeUndefined();
    expect(findMatch("Asa", list)).toBeUndefined();
  });

  test("each change becomes add, change, stop, keep, or a note that there is nothing to stop", () => {
    const plans = planMedications(
      [
        change("a", "dose_changed", "Lisinopril", "20 mg once daily (was 10 mg)"),
        change("b", "stopped", "Metformin"),
        change("c", "new", "Furosemide", "20 mg every morning"),
        change("d", "continue", "Lisinopril"),
        change("e", "stopped", "Warfarin"),
        change("f", "continue", "Aspirin", "81 mg daily"),
        change("g", "new", "   "),
      ],
      list,
    );
    expect(plans.map((p) => p.action)).toEqual(["update", "stop", "add", "keep", "absent", "missing"]);
    expect(plans[0]).toMatchObject({ medId: "m-lis", from: "10 mg", to: "20 mg" });
    expect(plans[1]).toMatchObject({ medId: "m-met", current: "Metformin ER 500 mg" });
    expect(plans[2]).toMatchObject({ dose: "20 mg", schedule: "daily" });
  });
});

describe("applying a visit", () => {
  const input = ApplyVisitSchema.parse({
    circleId,
    visitDate: "2026-11-03",
    clinic: "Riverbend Clinic",
    meds: [
      { action: "add", name: "Furosemide", detail: "20 mg every morning", dose: "20 mg", schedule: "daily" },
      { action: "stop", medId: "44444444-4444-4444-8444-444444444444" },
    ],
    todos: [{ title: "Book a follow-up", dueDate: "2026-11-17", assignee: "caregiver" }],
  });

  test("only the caregiver can, and nothing reaches the database otherwise", async () => {
    expect((await applyVisit(family, input)).ok).toBe(false);
    expect(clientFor).not.toHaveBeenCalled();
  });

  test("rows are marked as coming from the visit and kept in the circle", async () => {
    const inserts: { table: string; row: Record<string, unknown> }[] = [];
    const updates: Record<string, unknown>[] = [];
    const eqs: [string, unknown][] = [];
    const chain = {
      eq: (column: string, value: unknown) => {
        eqs.push([column, value]);
        return chain;
      },
      select: () => ({ maybeSingle: async () => ({ data: { id: "x" }, error: null }) }),
    };
    clientFor.mockReturnValue({
      from: (table: string) => ({
        insert: async (row: Record<string, unknown>) => {
          inserts.push({ table, row });
          return { error: null };
        },
        update: (row: Record<string, unknown>) => {
          updates.push(row);
          return chain;
        },
      }),
    });
    const result = await applyVisit(owner, input);
    expect(result).toEqual({ ok: true, added: 1, changed: 0, stopped: 1, todos: 1, failed: 0 });
    expect(inserts.find((i) => i.table === "medications")?.row).toMatchObject({ circle_id: circleId, source: "handoff", start_date: "2026-11-03" });
    expect(updates[0]).toMatchObject({ status: "stopped", stop_date: "2026-11-03", source: "handoff" });
    expect(eqs).toContainEqual(["circle_id", circleId]);
    expect(inserts.find((i) => i.table === "todos")?.row).toMatchObject({ assigned_to_caregiver: true, source: "handoff", note: "From the visit at Riverbend Clinic" });
    expect(inserts.find((i) => i.table === "activity")?.row).toMatchObject({ action: "visit_applied" });
  });

  test("unknown fields and ids that are not uuids are refused", () => {
    expect(ApplyVisitSchema.safeParse({ ...input, meds: [{ action: "stop", medId: "Lisinopril" }] }).success).toBe(false);
    expect(ApplyVisitSchema.safeParse({ ...input, extra: true }).success).toBe(false);
  });
});
