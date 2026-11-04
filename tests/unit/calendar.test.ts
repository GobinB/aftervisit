import { beforeEach, describe, expect, test, vi } from "vitest";
import type { Actor } from "@/lib/auth";
import { calendarItems } from "@/lib/calendar-rows";
import type { PersonView } from "@/lib/schema/circles";
import { EventInputSchema, expand, monthGrid, occurrences, shiftMonth, timeText, type CareEvent } from "@/lib/schema/events";
import type { Todo } from "@/lib/schema/todos";

const { clientFor } = vi.hoisted(() => ({ clientFor: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/store/db", () => ({ clientFor }));

import { deleteEvent, goToEvent, saveEvent } from "@/services/events";

const circleId = "22222222-2222-4222-8222-222222222222";
const FAMILY_ID = "33333333-3333-4333-8333-333333333302";
const owner: Actor = { kind: "caregiver", userId: "user-owner", circleIds: [circleId], role: "owner", accessToken: "token" };
const family: Actor = { kind: "helper", memberId: FAMILY_ID, circleId, role: "family", visibility: {} };
const aide: Actor = { kind: "helper", memberId: "33333333-3333-4333-8333-333333333301", circleId, role: "home_aide", visibility: {} };

const ev = (fields: Partial<CareEvent> & Pick<CareEvent, "id" | "date">): CareEvent => ({
  title: fields.id,
  startTime: null,
  endTime: null,
  location: null,
  notes: null,
  repeat: "none",
  repeatUntil: null,
  going: null,
  needsVolunteer: false,
  ...fields,
});

beforeEach(() => clientFor.mockReset());

describe("repeats", () => {
  test("one-off, weekly with an end, and every two weeks", () => {
    expect(occurrences(ev({ id: "a", date: "2026-11-10" }), "2026-11-01", "2026-11-30")).toEqual(["2026-11-10"]);
    expect(occurrences(ev({ id: "a", date: "2026-12-10" }), "2026-11-01", "2026-11-30")).toEqual([]);
    expect(occurrences(ev({ id: "w", date: "2026-11-03", repeat: "weekly", repeatUntil: "2026-11-20" }), "2026-11-01", "2026-12-31")).toEqual([
      "2026-11-03",
      "2026-11-10",
      "2026-11-17",
    ]);
    expect(occurrences(ev({ id: "b", date: "2026-10-27", repeat: "every_2_weeks" }), "2026-11-01", "2026-11-30")).toEqual(["2026-11-10", "2026-11-24"]);
  });

  test("monthly on the 31st skips short months; yearly on February 29 only in leap years", () => {
    expect(occurrences(ev({ id: "m", date: "2026-01-31", repeat: "monthly" }), "2026-01-01", "2026-05-31")).toEqual(["2026-01-31", "2026-03-31", "2026-05-31"]);
    expect(occurrences(ev({ id: "y", date: "2024-02-29", repeat: "yearly" }), "2024-01-01", "2029-01-01")).toEqual(["2024-02-29", "2028-02-29"]);
  });

  test("expand sorts by date, then time, all-day first", () => {
    const list = expand(
      [ev({ id: "late", date: "2026-11-05", startTime: "15:00" }), ev({ id: "allday", date: "2026-11-05" }), ev({ id: "early", date: "2026-11-04", startTime: "09:00" })],
      "2026-11-01",
      "2026-11-30",
    );
    expect(list.map((o) => o.event.id)).toEqual(["early", "allday", "late"]);
  });

  test("times and months read plainly", () => {
    expect(timeText({ startTime: null, endTime: null })).toBe("All day");
    expect(timeText({ startTime: "09:00", endTime: "10:30" })).toBe("9 AM to 10:30 AM");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    const grid = monthGrid("2026-11");
    expect(grid[0][0]).toBe("2026-11-01");
    expect(grid.every((week) => week.length === 7)).toBe(true);
    expect(grid.flat()).toContain("2026-11-30");
  });
});

describe("event input", () => {
  const base = { circleId, title: "Cardiology", date: "2026-11-20" };
  test("end after start, and repeats end after they begin", () => {
    expect(EventInputSchema.safeParse(base).success).toBe(true);
    expect(EventInputSchema.safeParse({ ...base, startTime: "10:00", endTime: "09:00" }).success).toBe(false);
    expect(EventInputSchema.safeParse({ ...base, endTime: "09:00" }).success).toBe(false);
    expect(EventInputSchema.safeParse({ ...base, repeat: "none", repeatUntil: "2026-12-01" }).success).toBe(false);
    expect(EventInputSchema.safeParse({ ...base, repeat: "weekly", repeatUntil: "2026-11-01" }).success).toBe(false);
    expect(EventInputSchema.safeParse({ ...base, going: "Rosa" }).success).toBe(false);
  });
});

describe("calendar permissions", () => {
  test("an aide cannot add, take or delete events; family cannot delete", async () => {
    expect((await saveEvent(aide, EventInputSchema.parse({ circleId, title: "x", date: "2026-11-20" }))).ok).toBe(false);
    expect((await goToEvent(aide, circleId, "e")).ok).toBe(false);
    expect((await deleteEvent(family, circleId, "e")).ok).toBe(false);
    expect(clientFor).not.toHaveBeenCalled();
  });

  test("family saying I'll go takes it only if nobody has", async () => {
    const eqs: [string, unknown][] = [];
    const chain = {
      eq: (column: string, value: unknown) => {
        eqs.push([column, value]);
        return chain;
      },
      is: (column: string, value: unknown) => {
        eqs.push([column, value]);
        return chain;
      },
      select: () => ({ maybeSingle: async () => ({ data: { id: "e" }, error: null }) }),
    };
    const update = vi.fn(() => chain);
    clientFor.mockReturnValue({ from: (table: string) => (table === "activity" ? { insert: async () => ({ error: null }) } : { update }) });
    expect((await goToEvent(family, circleId, "e")).ok).toBe(true);
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ going_member_id: FAMILY_ID, needs_volunteer: false }));
    expect(eqs).toEqual(expect.arrayContaining([["needs_volunteer", true], ["going_member_id", null], ["going_caregiver", false], ["circle_id", circleId]]));
  });

  test("calendar items name who is going and add due to-dos", () => {
    const people: PersonView[] = [
      { id: "user-owner", name: "Lisa", role: "owner", roleLabel: "Caregiver", kind: "caregiver" },
      { id: FAMILY_ID, name: "Sam", role: "family", roleLabel: "Family", kind: "member" },
    ];
    const todo: Todo = { id: "t", title: "Refill", note: null, dueDate: "2026-11-06", assignee: null, status: "open", doneAt: null, createdAt: "2026-11-01T00:00:00Z" };
    const items = calendarItems(
      family,
      circleId,
      [ev({ id: "x", date: "2026-11-05", going: { kind: "member", memberId: FAMILY_ID } }), ev({ id: "y", date: "2026-11-05", needsVolunteer: true }), ev({ id: "z", date: "2026-11-07", going: { kind: "caregiver" } })],
      [todo],
      people,
      "2026-11-01",
      "2026-11-30",
    );
    const byId = Object.fromEntries(items.map((item) => [item.id, item]));
    expect(byId.x.who).toBe("You");
    expect(byId.y.needsSomeone && byId.y.canGo).toBe(true);
    expect(byId.z.who).toBe("Lisa");
    expect(byId.t.kind).toBe("todo");
    expect(calendarItems(aide, circleId, [ev({ id: "y", date: "2026-11-05", needsVolunteer: true })], [], people, "2026-11-01", "2026-11-30")[0].canGo).toBe(false);
    expect(calendarItems(owner, circleId, [ev({ id: "z", date: "2026-11-07", going: { kind: "caregiver" } })], [], people, "2026-11-01", "2026-11-30")[0].who).toBe("You");
  });
});
