import { beforeEach, describe, expect, test, vi } from "vitest";
import type { Actor } from "@/lib/auth";
import { emptyState, fakeClient, type FakeState } from "../helpers/fake-circle-db";

/**
 * One link per person, shared again from any device, with the members service and actions over an
 * in-memory database (tests/helpers/fake-circle-db.ts). supabase/tests/links_updates.test.sql checks
 * the real database's limits and change records.
 */
vi.mock("server-only", () => ({}));
let state: FakeState = emptyState();
vi.mock("@/store/db", () => ({
  clientFor: (actor: Actor) => fakeClient(state, actor.kind === "caregiver" ? actor.userId : null),
  serviceClient: () => fakeClient(state, null),
}));
const env = { helperSessionSecret: "test-helper-secret-0123456789", salt: "test-salt" };
vi.mock("@/lib/env", () => ({ env, RATE_LIMITS: {} }));

const { addMember, getPendingUpdates, markTold, memberLink, newMemberLink } = await import("@/services/members");
const { memberToken } = await import("@/lib/member-token");
const { hashInvite, INVITE_RE } = await import("@/lib/invites");

const CIRCLE = "22222222-2222-4222-8222-222222222222";
const owner: Actor = { kind: "caregiver", userId: "user-owner", circleIds: [CIRCLE], role: "owner", accessToken: "token" };
const other: Actor = { kind: "caregiver", userId: "user-other", circleIds: [], role: null, accessToken: "token" };
const family: Actor = { kind: "helper", memberId: "33333333-3333-4333-8333-333333333301", circleId: CIRCLE, role: "family", visibility: {} };
const DAY = 24 * 60 * 60 * 1000;

beforeEach(() => {
  state = emptyState();
  env.helperSessionSecret = "test-helper-secret-0123456789";
  state.circles.push({ id: CIRCLE, key_version: 1, deleted_at: null });
  state.circle_caregivers.push({ circle_id: CIRCLE, user_id: "user-owner", role: "owner", circle_key_wrapped: null, key_version: 1 });
});

const row = (id: string) => state.members.find((member) => member.id === id)!;

async function add(name = "Rosa Diaz", pin?: string) {
  const added = await addMember(owner, { circleId: CIRCLE, name, role: "family", ...(pin ? { pin } : {}) });
  if (!added.ok) throw new Error(added.error);
  return added;
}

describe("a person's link", () => {
  test("is worked out from their id, is 24 characters, and changes with the link number", () => {
    const a = memberToken("33333333-3333-4333-8333-333333333301", 1)!;
    expect(INVITE_RE.test(a)).toBe(true);
    expect(memberToken("33333333-3333-4333-8333-333333333301", 1)).toBe(a);
    expect(memberToken("33333333-3333-4333-8333-333333333301", 2)).not.toBe(a);
    expect(memberToken("33333333-3333-4333-8333-333333333302", 1)).not.toBe(a);
    env.helperSessionSecret = "another-secret";
    expect(memberToken("33333333-3333-4333-8333-333333333301", 1)).not.toBe(a);
    env.helperSessionSecret = "";
    expect(memberToken("33333333-3333-4333-8333-333333333301", 1)).toBeNull();
  });

  test("is stored only as a hash, and the same link comes back every time it is shared, from any device", async () => {
    const added = await add();
    expect(row(added.memberId).token_hash).toBe(hashInvite(added.token));
    expect(JSON.stringify(state.members)).not.toContain(added.token);
    const again = await memberLink(owner, CIRCLE, added.memberId);
    const later = await memberLink(owner, CIRCLE, added.memberId);
    expect(again).toMatchObject({ ok: true, token: added.token, hasPin: false });
    expect(later).toMatchObject({ ok: true, token: added.token });
  });

  test("works for 30 days at first, and never longer than 90 days after it was made", async () => {
    const before = Date.now();
    const added = await add();
    const expires = new Date(row(added.memberId).expires_at as string).getTime();
    expect(expires - before).toBeGreaterThanOrEqual(30 * DAY - 1000);
    expect(expires - before).toBeLessThanOrEqual(30 * DAY + 1000);
  });

  test("New link changes it, starts its own limits, and keeps the PIN", async () => {
    const added = await add("Ana Lee", "4821");
    const pinHash = row(added.memberId).pin_hash;
    row(added.memberId).link_issued_at = new Date(Date.now() - 80 * DAY).toISOString();
    const fresh = await newMemberLink(owner, CIRCLE, added.memberId);
    if (!fresh.ok) throw new Error(fresh.error);
    expect(fresh.token).not.toBe(added.token);
    expect(fresh.hasPin).toBe(true);
    expect(row(added.memberId)).toMatchObject({ link_version: 2, token_hash: hashInvite(fresh.token), pin_hash: pinHash });
    expect(Date.now() - new Date(row(added.memberId).link_issued_at as string).getTime()).toBeLessThan(5000);
    expect(await memberLink(owner, CIRCLE, added.memberId)).toMatchObject({ ok: true, token: fresh.token, hasPin: true });
  });

  test("is not shared again once it is turned off or has ended", async () => {
    const added = await add();
    row(added.memberId).expires_at = new Date(Date.now() - 1000).toISOString();
    expect(await memberLink(owner, CIRCLE, added.memberId)).toMatchObject({ ok: false, error: "Rosa's link has ended. Send them a fresh link." });
    row(added.memberId).revoked_at = new Date().toISOString();
    expect(await memberLink(owner, CIRCLE, added.memberId)).toMatchObject({ ok: false, error: "Rosa's link is turned off. Make a new link to let them back in." });
  });

  test("only the caregiver can see or change a person's link", async () => {
    const added = await add();
    expect((await memberLink(family, CIRCLE, added.memberId)).ok).toBe(false);
    expect((await memberLink(other, CIRCLE, added.memberId)).ok).toBe(false);
    expect((await newMemberLink(family, CIRCLE, added.memberId)).ok).toBe(false);
    expect((await markTold(family, CIRCLE, [added.memberId])).ok).toBe(false);
    expect(await getPendingUpdates(family, CIRCLE)).toEqual([]);
  });

  test("a link made before links could be shared again is replaced the first time it is shared", async () => {
    const added = await add();
    row(added.memberId).token_hash = hashInvite("legacyrandomtokenaaaaaaa");
    const shared = await memberLink(owner, CIRCLE, added.memberId);
    expect(shared).toMatchObject({ ok: true, token: added.token });
    expect(row(added.memberId).token_hash).toBe(hashInvite(added.token));
  });

  test("without the secret, no link is made", async () => {
    env.helperSessionSecret = "";
    expect(await addMember(owner, { circleId: CIRCLE, name: "Rosa", role: "family" })).toEqual({ ok: false, error: "Links are not set up on this site yet." });
  });
});

describe("telling people about a change", () => {
  test("after a change, the people who can see it are listed until they are told", async () => {
    const rosa = await add("Rosa Diaz");
    const sam = await add("Sam Lee");
    // Both were given their links a while ago; the caregiver changed medicines just now.
    for (const id of [rosa.memberId, sam.memberId]) row(id).link_issued_at = new Date(Date.now() - DAY).toISOString();
    state.circle_updates.push({ circle_id: CIRCLE, area: "medications", changed_at: new Date().toISOString() });
    const pending = await getPendingUpdates(owner, CIRCLE);
    expect(pending.map((person) => person.name)).toEqual(["Rosa Diaz", "Sam Lee"]);
    expect(pending[0].areas).toEqual(["medications"]);

    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(await markTold(owner, CIRCLE, [rosa.memberId])).toEqual({ ok: true });
    expect((await getPendingUpdates(owner, CIRCLE)).map((person) => person.name)).toEqual(["Sam Lee"]);
  });

  test("a person whose link is off or has ended is not listed", async () => {
    const rosa = await add("Rosa Diaz");
    row(rosa.memberId).link_issued_at = new Date(Date.now() - DAY).toISOString();
    state.circle_updates.push({ circle_id: CIRCLE, area: "calendar", changed_at: new Date().toISOString() });
    row(rosa.memberId).expires_at = new Date(Date.now() - 1000).toISOString();
    expect(await getPendingUpdates(owner, CIRCLE)).toEqual([]);
  });
});
