import { beforeEach, describe, expect, test, vi } from "vitest";
import type { Actor } from "@/lib/auth";

const { clientFor, serviceClient } = vi.hoisted(() => ({ clientFor: vi.fn(), serviceClient: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/store/db", () => ({ clientFor, serviceClient }));

import { feedFile, getFeed, setFeedMedicines, startFeed, stopFeed } from "@/services/calendar-feed";

const circleId = "22222222-2222-4222-8222-222222222222";
const owner: Actor = { kind: "caregiver", userId: "user-owner", circleIds: [circleId], role: "owner", accessToken: "token" };
const stranger: Actor = { kind: "caregiver", userId: "user-other", circleIds: [], role: null, accessToken: "token" };
const helper: Actor = { kind: "helper", memberId: "33333333-3333-4333-8333-333333333301", circleId, role: "family", visibility: {} };

beforeEach(() => {
  clientFor.mockReset();
  serviceClient.mockReset();
});

describe("calendar link", () => {
  test("people with a link and other caregivers cannot see, make or turn off the link", async () => {
    expect(await getFeed(helper, circleId)).toBeUndefined();
    expect(await getFeed(stranger, circleId)).toBeUndefined();
    expect((await startFeed(helper, circleId)).ok).toBe(false);
    expect((await stopFeed(stranger, circleId)).ok).toBe(false);
    expect(clientFor).not.toHaveBeenCalled();
  });

  test("a new link replaces the old one with a long random token", async () => {
    const calls: string[] = [];
    let inserted: Record<string, unknown> | null = null;
    clientFor.mockReturnValue({
      from: () => ({
        select: () => ({ eq: () => ({ maybeSingle: async () => (calls.push("read"), { data: null }) }) }),
        delete: () => ({ eq: async () => (calls.push("delete"), { error: null }) }),
        insert: async (row: Record<string, unknown>) => {
          calls.push("insert");
          inserted = row;
          return { error: null };
        },
      }),
    });
    const result = await startFeed(owner, circleId);
    expect(calls).toEqual(["read", "delete", "insert"]);
    expect(inserted).toMatchObject({ circle_id: circleId, created_by: "user-owner", include_medicines: true });
    expect(String((inserted as unknown as { token: string }).token)).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(result.ok && result.url).toMatch(/\/api\/calendar\/[A-Za-z0-9_-]{43}\.ics$/);
  });

  test("a malformed or unknown link gives nothing", async () => {
    expect(await feedFile("short")).toBeNull();
    expect(await feedFile("../../etc/passwd")).toBeNull();
    expect(serviceClient).not.toHaveBeenCalled();
    serviceClient.mockReturnValue({
      from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) }),
    });
    expect(await feedFile("a".repeat(43))).toBeNull();
  });

  test("a new link keeps medicines left out when the old one had them left out", async () => {
    let inserted: Record<string, unknown> | null = null;
    clientFor.mockReturnValue({
      from: () => ({
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { include_medicines: false } }) }) }),
        delete: () => ({ eq: async () => ({ error: null }) }),
        insert: async (row: Record<string, unknown>) => ((inserted = row), { error: null }),
      }),
    });
    const result = await startFeed(owner, circleId);
    expect(result.ok && result.includeMedicines).toBe(false);
    expect(inserted).toMatchObject({ include_medicines: false });
  });

  test("only the caregiver can put medicines in or leave them out", async () => {
    expect((await setFeedMedicines(helper, circleId, false)).ok).toBe(false);
    expect((await setFeedMedicines(stranger, circleId, false)).ok).toBe(false);
    expect(clientFor).not.toHaveBeenCalled();
    let update: Record<string, unknown> | null = null;
    clientFor.mockReturnValue({
      from: () => ({
        update: (row: Record<string, unknown>) => {
          update = row;
          return { eq: () => ({ select: () => ({ maybeSingle: async () => ({ data: { circle_id: circleId }, error: null }) }) }) };
        },
      }),
    });
    expect((await setFeedMedicines(owner, circleId, false)).ok).toBe(true);
    expect(update).toEqual({ include_medicines: false });
  });
});

/** A stand-in for the database the calendar file is read from, recording which tables were asked for. */
function feedDb(includeMedicines: boolean) {
  const asked: string[] = [];
  const rows: Record<string, unknown> = {
    calendar_feeds: { circle_id: circleId, include_medicines: includeMedicines },
    circles: { content: { person_name: "Rosa Delgado" }, owner_id: "user-owner" },
    events: [],
    todos: [],
    members: [],
    medications: [
      {
        id: "med-a",
        name: "Metformin",
        dose: "500 mg",
        amount: null,
        form: "tablet",
        schedule: "daily",
        every: null,
        weekdays: [],
        times: ["08:00", "20:00"],
        start_date: "2026-11-01",
        stop_date: null,
        status: "active",
        updated_at: "2026-11-01T09:00:00Z",
      },
    ],
  };
  // Every query method returns the same chain; awaiting it, or maybeSingle(), gives the table's rows.
  const chain = (table: string): Record<string, unknown> => {
    const result = { data: rows[table], error: null };
    const self: Record<string, unknown> = {
      then: (resolve: (value: unknown) => void) => resolve(result),
      maybeSingle: async () => result,
    };
    for (const name of ["select", "eq", "neq", "or", "is", "not", "limit"]) self[name] = () => self;
    return self;
  };
  return {
    asked,
    client: {
      from: (table: string) => (asked.push(table), chain(table)),
      auth: { admin: { getUserById: async () => ({ data: { user: { user_metadata: { name: "Sam Example" } } } }) } },
    },
  };
}

describe("calendar file", () => {
  test("carries medicine times when medicines are on", async () => {
    const db = feedDb(true);
    serviceClient.mockReturnValue(db.client);
    const file = await feedFile("a".repeat(43));
    expect(db.asked).toContain("medications");
    expect(file).toContain("X-WR-CALNAME:Rosa Delgado's care");
    expect(file).toContain("UID:med-med-a-0800@");
    expect(file).toContain("UID:med-med-a-2000@");
    expect(file).toContain("SUMMARY:Metformin · 500 mg · Tablet");
    expect(file).toContain("RRULE:FREQ=DAILY");
  });

  test("leaves medicines out, without reading them, when the caregiver turned them off", async () => {
    const db = feedDb(false);
    serviceClient.mockReturnValue(db.client);
    const file = await feedFile("a".repeat(43));
    expect(db.asked).not.toContain("medications");
    expect(file).toContain("BEGIN:VCALENDAR");
    expect(file).not.toContain("Metformin");
  });
});
