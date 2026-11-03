import { createHash } from "node:crypto";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { Actor } from "@/lib/auth";
import { CONSENT_TEXT, CONSENT_TYPES, CONSENT_VERSION, type ConsentType } from "@/lib/schema/circles";

vi.mock("server-only", () => ({}));

const clientFor = vi.fn();
const createCircleRecord = vi.fn();
vi.mock("@/store/db", () => ({
  clientFor: (...args: unknown[]) => clientFor(...args),
  createCircleRecord: (...args: unknown[]) => createCircleRecord(...args),
}));
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
  createCircleRecord.mockReset();
});

const circleInput = {
  content: { person_name: "Margaret Ward", allergies: [], doctors: [], emergency_contacts: [] },
  consents: { authorized_to_share: true as const, terms: true as const, privacy: true as const },
};

function consentHash(type: ConsentType): string {
  return createHash("sha256").update(`${CONSENT_VERSION}\n${CONSENT_TEXT[type]}`).digest("hex");
}

describe("services call can() before store", () => {
  test("a helper cannot create a circle", async () => {
    const result = await createCircle(family, circleInput);
    expect(result).toEqual({ ok: false, error: "Sign in with Google to create a circle." });
    expect(clientFor).not.toHaveBeenCalled();
    expect(createCircleRecord).not.toHaveBeenCalled();
  });

  test("a signed-in caregiver creates a circle through create_circle", async () => {
    const caregiver = { kind: "caregiver" as const, userId: "user-new", circleIds: [], role: null, accessToken: "token" };
    createCircleRecord.mockResolvedValue("11111111-1111-4111-8111-111111111111");
    const result = await createCircle(caregiver, circleInput);
    expect(result).toEqual({ ok: true, circleId: "11111111-1111-4111-8111-111111111111" });
    expect(createCircleRecord).toHaveBeenCalledTimes(1);
    const [actor, payload] = createCircleRecord.mock.calls[0] as [
      Actor,
      { content: { person_name: string }; consents: { type: ConsentType; version: string; text_hash: string }[] },
    ];
    expect(actor).toBe(caregiver);
    expect(payload.content).toEqual(circleInput.content);
    expect(payload.consents).toEqual(
      CONSENT_TYPES.map((type) => ({ type, version: CONSENT_VERSION, text_hash: consentHash(type) })),
    );
    expect(payload).not.toHaveProperty("owner_id");
    expect(payload).not.toHaveProperty("role");
    expect(JSON.stringify(payload)).not.toContain(caregiver.userId);
    expect(clientFor).not.toHaveBeenCalled();
  });

  test("a failed create stays a generic error", async () => {
    const caregiver = { kind: "caregiver" as const, userId: "user-new", circleIds: [], role: null, accessToken: "token" };
    createCircleRecord.mockRejectedValue(new Error("circle content is not valid: Margaret Ward"));
    const result = await createCircle(caregiver, circleInput);
    expect(result).toEqual({ ok: false, error: "That could not be saved. Try again." });
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
