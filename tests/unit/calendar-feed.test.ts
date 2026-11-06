import { beforeEach, describe, expect, test, vi } from "vitest";
import type { Actor } from "@/lib/auth";

const { clientFor, serviceClient } = vi.hoisted(() => ({ clientFor: vi.fn(), serviceClient: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/store/db", () => ({ clientFor, serviceClient }));

import { feedFile, getFeed, startFeed, stopFeed } from "@/services/calendar-feed";

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
        delete: () => ({ eq: async () => (calls.push("delete"), { error: null }) }),
        insert: async (row: Record<string, unknown>) => {
          calls.push("insert");
          inserted = row;
          return { error: null };
        },
      }),
    });
    const result = await startFeed(owner, circleId);
    expect(calls).toEqual(["delete", "insert"]);
    expect(inserted).toMatchObject({ circle_id: circleId, created_by: "user-owner" });
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
});
