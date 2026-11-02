import { beforeEach, describe, expect, test, vi } from "vitest";
import type { Actor } from "@/lib/auth";

vi.mock("server-only", () => ({}));

const clientFor = vi.fn();
vi.mock("@/store/db", () => ({ clientFor: (...args: unknown[]) => clientFor(...args) }));
vi.mock("@/lib/invites", () => ({
  INVITE_RE: /^[A-Za-z0-9_-]{24}$/,
  newInviteToken: () => "abcdefghijklmnopqrstuvwx",
  hashInvite: (value: string) => `hash:${value}`,
}));
vi.mock("@/lib/access", () => ({ activeLock: () => null }));
vi.mock("@/lib/tokens", () => ({ hashPin: (id: string, pin: string) => `${id}:${pin}` }));

const { createCircle, deleteCircle } = await import("@/services/circles");
const { addMember } = await import("@/services/members");

const circleId = "22222222-2222-4222-8222-222222222222";

const owner: Actor = { kind: "caregiver", userId: "user-owner", circleIds: [circleId], role: "owner", accessToken: "token" };
const co: Actor = { kind: "caregiver", userId: "user-co", circleIds: [circleId], role: "co_caregiver", accessToken: "token" };
const family: Actor = {
  kind: "helper",
  memberId: "33333333-3333-4333-8333-333333333301",
  circleId,
  role: "family",
  visibility: {},
};

beforeEach(() => {
  clientFor.mockReset();
});

describe("services call can() before store", () => {
  test("a helper cannot create a circle", async () => {
    const result = await createCircle(family, {
      content: { person_name: "Margaret Ward", allergies: [], doctors: [], emergency_contacts: [] },
      consents: { authorized_to_share: true, terms: true, privacy: true },
      circleKeyWrapped: `av1.600000.${"a".repeat(22)}.${"b".repeat(16)}.${"c".repeat(64)}`,
      keyVersion: 1,
    });
    expect(result.ok).toBe(false);
    expect(clientFor).not.toHaveBeenCalled();
  });

  test("a co-caregiver cannot delete a circle", async () => {
    const result = await deleteCircle(co, circleId);
    expect(result.ok).toBe(false);
    expect(clientFor).not.toHaveBeenCalled();
  });

  test("a family member cannot add a person", async () => {
    const result = await addMember(family, { circleId, name: "Rosa", role: "home_aide" });
    expect(result.ok).toBe(false);
    expect(clientFor).not.toHaveBeenCalled();
  });

  test("the owner reaches the database only after the permission check", async () => {
    const calls: string[] = [];
    clientFor.mockImplementation(() => ({
      from(table: string) {
        calls.push(table);
        return {
          insert: async () => ({ error: null }),
          update: () => ({ eq: () => ({ is: async () => ({ error: null }) }) }),
        };
      },
    }));
    const result = await deleteCircle(owner, circleId);
    expect(result.ok).toBe(true);
    expect(calls).toContain("circles");
  });
});
