import { describe, expect, test } from "vitest";
import { linkTag } from "@/lib/helper-cookie";
import { helperFromRow, type MemberAccessRow } from "@/lib/helper-actor";

const CIRCLE = "22222222-2222-4222-8222-222222222222";
const HASH = "a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90";
const IVY = "44444444-4444-4444-8444-444444444444";
const NOW = Date.parse("2026-11-17T12:00:00Z");

function row(over: Partial<MemberAccessRow> = {}): MemberAccessRow {
  return {
    id: "55555555-5555-4555-8555-555555555555",
    role: "care_manager",
    visibility: { hidden: ["medications"] },
    revoked_at: null,
    expires_at: "2026-12-01T00:00:00Z",
    token_hash: HASH,
    user_id: null,
    ...over,
  };
}

const link = { via: "link" as const, link: linkTag(HASH) };
const account = { via: "account" as const, userId: IVY };

describe("a person in the circle, from their link", () => {
  test("opens with the cookie from their current link; role and what they see come from the row", () => {
    expect(helperFromRow(row(), CIRCLE, link, NOW)).toEqual({
      kind: "helper",
      memberId: "55555555-5555-4555-8555-555555555555",
      circleId: CIRCLE,
      role: "care_manager",
      visibility: { hidden: ["medications"] },
    });
  });

  test("a cookie from an older link is refused", () => {
    expect(helperFromRow(row({ token_hash: HASH.replace("a1", "ff") }), CIRCLE, link, NOW)).toBeNull();
  });

  test("once saved to an account, the link's cookie alone no longer opens it (a forwarded link, or a phone that opened it before)", () => {
    expect(helperFromRow(row({ user_id: IVY }), CIRCLE, link, NOW)).toBeNull();
  });

  test("after the caregiver's Undo the same cookie works again", () => {
    expect(helperFromRow(row({ user_id: null }), CIRCLE, link, NOW)).not.toBeNull();
  });
});

describe("a person in the circle, signed in with their account", () => {
  test("is the same helper, with their user id; role and what they see still come from the row", () => {
    expect(helperFromRow(row({ user_id: IVY, role: "family", visibility: {} }), CIRCLE, account, NOW)).toEqual({
      kind: "helper",
      memberId: "55555555-5555-4555-8555-555555555555",
      circleId: CIRCLE,
      role: "family",
      visibility: {},
      userId: IVY,
    });
  });

  test("works whatever link is current: New link does not sign them out", () => {
    expect(helperFromRow(row({ user_id: IVY, token_hash: "different" }), CIRCLE, account, NOW)).not.toBeNull();
  });

  test("someone else's account is refused, and so is a row not saved to any account", () => {
    expect(helperFromRow(row({ user_id: "66666666-6666-4666-8666-666666666666" }), CIRCLE, account, NOW)).toBeNull();
    expect(helperFromRow(row({ user_id: null }), CIRCLE, account, NOW)).toBeNull();
  });
});

describe("either way in", () => {
  test("a removed person is refused", () => {
    expect(helperFromRow(row({ revoked_at: "2026-11-16T00:00:00Z" }), CIRCLE, link, NOW)).toBeNull();
    expect(helperFromRow(row({ revoked_at: "2026-11-16T00:00:00Z", user_id: IVY }), CIRCLE, account, NOW)).toBeNull();
  });

  test("an ended link is refused", () => {
    expect(helperFromRow(row({ expires_at: "2026-11-17T11:59:59Z" }), CIRCLE, link, NOW)).toBeNull();
    expect(helperFromRow(row({ expires_at: "2026-11-17T11:59:59Z", user_id: IVY }), CIRCLE, account, NOW)).toBeNull();
  });

  test("a role that is not a helper role is refused, so nobody becomes a caregiver this way", () => {
    expect(helperFromRow(row({ role: "owner", user_id: IVY }), CIRCLE, account, NOW)).toBeNull();
    expect(helperFromRow(row({ role: "owner" }), CIRCLE, link, NOW)).toBeNull();
  });

  test("a stored visibility that does not parse falls back to none hidden, as before", () => {
    expect(helperFromRow(row({ visibility: { members: "everyone" } }), CIRCLE, link, NOW)?.visibility).toEqual({});
  });
});
