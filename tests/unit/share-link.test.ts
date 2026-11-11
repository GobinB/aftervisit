import { beforeEach, describe, expect, test, vi } from "vitest";
import type { Actor } from "@/lib/auth";

const { clientFor, serviceClient } = vi.hoisted(() => ({ clientFor: vi.fn(), serviceClient: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/store/db", () => ({ clientFor, serviceClient }));

import { hashInvite } from "@/lib/invites";
import { hashPin } from "@/lib/tokens";
import { newPin, shareMemberLink } from "@/services/members";

const circleId = "22222222-2222-4222-8222-222222222222";
const memberId = "33333333-3333-4333-8333-333333333301";
const owner: Actor = { kind: "caregiver", userId: "user-owner", circleIds: [circleId], role: "owner", accessToken: "token" };
const helper: Actor = { kind: "helper", memberId, circleId, role: "family", visibility: {} };

/** A stand-in for the members table: records the update and its filters, and answers with `row`. */
function membersTable(row: { name: string; email: string | null } | null) {
  const seen: { update?: Record<string, unknown>; filters: string[]; activity: unknown[] } = { filters: [], activity: [] };
  const query = {
    update(values: Record<string, unknown>) {
      seen.update = values;
      return query;
    },
    eq(column: string, value: string) {
      seen.filters.push(`${column}=${value}`);
      return query;
    },
    is(column: string, value: null) {
      seen.filters.push(`${column} is ${value}`);
      return query;
    },
    select: () => query,
    maybeSingle: async () => ({ data: row, error: null }),
  };
  clientFor.mockReturnValue({
    from: (table: string) => (table === "members" ? query : { insert: async (values: unknown) => void seen.activity.push(values) }),
  });
  return seen;
}

beforeEach(() => {
  process.env.IP_HASH_SALT = "test-salt";
  clientFor.mockReset();
});

describe("a new link after a visit", () => {
  test("a PIN is always four digits", () => {
    for (let i = 0; i < 200; i++) expect(newPin()).toMatch(/^\d{4}$/);
  });

  test("replaces the link and the PIN, and keeps only their hashes", async () => {
    const seen = membersTable({ name: "Sam Rivera", email: "sam@example.com" });
    const result = await shareMemberLink(owner, circleId, memberId);
    if (!result.ok) throw new Error(result.error);
    expect(result.pin).toMatch(/^\d{4}$/);
    expect(result).toMatchObject({ memberId, name: "Sam Rivera", email: "sam@example.com" });
    expect(seen.update).toMatchObject({
      token_hash: hashInvite(result.token),
      pin_hash: hashPin(memberId, result.pin),
      pin_failures: 0,
      locked_until: null,
      lock_count: 0,
    });
    expect(JSON.stringify(seen.update)).not.toContain(result.token);
    // A removed person is not let back in by a visit update.
    expect(seen.update).not.toHaveProperty("revoked_at");
    expect(seen.filters).toEqual([`id=${memberId}`, `circle_id=${circleId}`, "revoked_at is null"]);
    expect(seen.activity).toHaveLength(1);
  });

  test("gives a different link and PIN each time", async () => {
    membersTable({ name: "Sam", email: null });
    const tokens = new Set<string>();
    const pins = new Set<string>();
    for (let i = 0; i < 12; i++) {
      const result = await shareMemberLink(owner, circleId, memberId);
      if (!result.ok) throw new Error(result.error);
      tokens.add(result.token);
      pins.add(result.pin);
    }
    expect(tokens.size).toBe(12);
    expect(pins.size).toBeGreaterThan(1);
  });

  test("a removed or unknown person gets no link", async () => {
    membersTable(null);
    expect(await shareMemberLink(owner, circleId, memberId)).toMatchObject({ ok: false });
  });

  test("a person with a link cannot make links", async () => {
    const seen = membersTable({ name: "Sam", email: null });
    expect(await shareMemberLink(helper, circleId, memberId)).toMatchObject({ ok: false });
    expect(seen.update).toBeUndefined();
  });
});
