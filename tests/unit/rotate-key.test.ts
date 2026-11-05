import { beforeEach, describe, expect, test, vi } from "vitest";
import type { Actor } from "@/lib/auth";

vi.mock("server-only", () => ({}));

const rpc = vi.fn();
const from = vi.fn();
vi.mock("@/store/db", () => ({ clientFor: () => ({ rpc, from }) }));
vi.mock("@/lib/invites", () => ({
  newInviteToken: () => "abcdefghijklmnopqrstuvwx",
  hashInvite: () => "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
}));

const { rotateCircleKey, storeOwnCircleKey } = await import("@/services/circles");

const circleId = "22222222-2222-4222-8222-222222222222";
const wrapped = `av1.600000.${"a".repeat(22)}.${"b".repeat(16)}.${"c".repeat(64)}`;
const owner: Actor = { kind: "caregiver", userId: "user-owner", circleIds: [circleId], role: "owner", accessToken: "token" };
/** Signed in with Google, but not this circle's caregiver. */
const stranger: Actor = { kind: "caregiver", userId: "user-stranger", circleIds: [], role: null, accessToken: "token" };
const family: Actor = { kind: "helper", memberId: "33333333-3333-4333-8333-333333333301", circleId, role: "family", visibility: {} };

function builder(table: string) {
  let op = "select";
  const result = () => {
    if (table === "circles") return { data: { key_version: 1 }, error: null };
    if (table === "members" && op === "select") return { data: [{ id: "member-1", name: "Rosa", email: "rosa@example.com" }], error: null };
    if (table === "members") return { data: { id: "member-1" }, error: null };
    return { data: null, error: null };
  };
  const api = {
    select() {
      return api;
    },
    update() {
      op = "update";
      return api;
    },
    insert() {
      op = "insert";
      return Promise.resolve(result());
    },
    eq() {
      return api;
    },
    is() {
      return api;
    },
    maybeSingle() {
      return Promise.resolve(result());
    },
    then(resolve: (value: ReturnType<typeof result>) => unknown, reject?: (reason: unknown) => unknown) {
      return Promise.resolve(result()).then(resolve, reject);
    },
  };
  return api;
}

beforeEach(() => {
  rpc.mockReset();
  from.mockReset();
  rpc.mockResolvedValue({ data: 2, error: null });
  from.mockImplementation((table: string) => builder(table));
});

describe("rotate circle key", () => {
  test("a helper cannot rotate, and the database is not called", async () => {
    const result = await rotateCircleKey(family, circleId, wrapped, 2);
    expect(result.ok).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
    expect(from).not.toHaveBeenCalled();
  });

  test("the owner stores the next version and the wrapped key, then receives tokens", async () => {
    const result = await rotateCircleKey(owner, circleId, wrapped, 2);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.keyVersion).toBe(2);
    expect(result.links).toEqual([{ token: "abcdefghijklmnopqrstuvwx", name: "Rosa", email: "rosa@example.com" }]);
    expect(rpc).toHaveBeenCalledWith("rotate_own_circle_key", {
      p_circle: circleId,
      p_wrapped: wrapped,
      p_version: 2,
      p_member_tokens: [{ id: "member-1", token_hash: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" }],
    });
    expect(JSON.stringify(rpc.mock.calls)).not.toContain("abcdefghijklmnopqrstuvwx");
    expect(JSON.stringify(rpc.mock.calls)).not.toContain("#k=");
  });

  test("a skipped version is refused before the database changes the key", async () => {
    const result = await rotateCircleKey(owner, circleId, wrapped, 4);
    expect(result.ok).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });

  test("a signed-in stranger cannot rotate", async () => {
    const result = await rotateCircleKey(stranger, circleId, wrapped, 2);
    expect(result.ok).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
    expect(from).not.toHaveBeenCalled();
  });

  test("a database failure returns no helper tokens", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: "helper links could not be replaced" } });
    const result = await rotateCircleKey(owner, circleId, wrapped, 2);
    expect(result.ok).toBe(false);
    expect(result).not.toHaveProperty("links");
  });

  test("a signed-in stranger cannot create the first key", async () => {
    const result = await storeOwnCircleKey(stranger, circleId, wrapped, 1);
    expect(result.ok).toBe(false);
    expect(from).not.toHaveBeenCalled();
  });
});
