import { beforeEach, describe, expect, test, vi } from "vitest";
import type { HandoffRow } from "@/lib/db";
import type { RecipientRow } from "@/lib/invites";

vi.mock("server-only", () => ({}));

const rpc = vi.fn();
vi.mock("@/lib/db", () => ({ db: () => ({ rpc }) }));

const { activeLock, checkPin, HARD_LOCK_AFTER, LOCK_MINUTES, MAX_PIN_ATTEMPTS, toPinCheck } = await import("@/lib/access");
const { COPY } = await import("@/lib/copy");
const { hashPin } = await import("@/lib/tokens");

const NOW = Date.parse("2026-11-01T12:00:00Z");
const later = (min: number) => new Date(NOW + min * 60_000).toISOString();

const row: HandoffRow = {
  token: "handoff-token-0000000", manage_key_hash: "manage-hash", pin_hash: "pin-hash",
  pin_failures: 0, locked_until: null, payload: {} as HandoffRow["payload"], source_text: null,
  original_path: null, created_by: "Gobin", recipients: [], acks: [],
  created_at: "2026-10-01T00:00:00Z", expires_at: "2026-12-01T00:00:00Z", access_mode: "invite",
};
const recipient = (over: Partial<RecipientRow> = {}): RecipientRow => ({
  id: "recipient-a", handoff_token: row.token, name: "Rosa", role: "home_aide", invite_hash: "invite-hash",
  sections: [], tasks_scope: "all", created_at: row.created_at, revoked_at: null, first_opened_at: null,
  last_opened_at: null, acked_at: null, pin_failures: 0, locked_until: null, pin_lock_count: 0, ...over,
});
const replies = (...rows: { result: string; locked_until?: string | null; attempts_left?: number | null }[]) =>
  rows.forEach((r) => rpc.mockReturnValueOnce({ single: async () => ({ data: { locked_until: null, attempts_left: null, ...r }, error: null }) }));

beforeEach(() => {
  rpc.mockReset();
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

describe("activeLock", () => {
  test("no lock, an expired lock, a running lock and a lock until the creator unlocks it", () => {
    expect(activeLock(null, NOW)).toBeNull();
    expect(activeLock(later(-1), NOW)).toBeNull();
    expect(activeLock(later(5), NOW)).toEqual({ lockedUntil: later(5) });
    expect(activeLock("infinity", NOW)).toEqual({ lockedUntil: null });
  });
});

describe("toPinCheck", () => {
  test("maps every try_pin result", () => {
    expect(toPinCheck({ result: "ok", locked_until: null, attempts_left: null })).toEqual({ ok: true });
    expect(toPinCheck({ result: "wrong_pin", locked_until: null, attempts_left: 2 })).toEqual({ ok: false, status: "wrong_pin", attemptsLeft: 2 });
    expect(toPinCheck({ result: "locked", locked_until: later(10), attempts_left: 0 })).toEqual({ ok: false, status: "locked", lockedUntil: later(10) });
    expect(toPinCheck({ result: "locked", locked_until: "infinity", attempts_left: 0 })).toEqual({ ok: false, status: "locked", lockedUntil: null });
    expect(() => toPinCheck({ result: "not_found", locked_until: null, attempts_left: null })).toThrow();
  });
});

describe("checkPin", () => {
  test("no PIN on the handoff: open without touching the database", async () => {
    await expect(checkPin({ ...row, pin_hash: null }, undefined, recipient())).resolves.toEqual({ ok: true });
    expect(rpc).not.toHaveBeenCalled();
  });

  test("a locked link is refused before the PIN is checked", async () => {
    await expect(checkPin(row, "1234", recipient({ locked_until: later(10) }))).resolves.toEqual({ ok: false, status: "locked", lockedUntil: later(10) });
    await expect(checkPin(row, "1234", recipient({ locked_until: "infinity" }))).resolves.toEqual({ ok: false, status: "locked", lockedUntil: null });
    expect(rpc).not.toHaveBeenCalled();
  });

  test("a personal link is counted on its own, even if the handoff row carries an old shared lock", async () => {
    replies({ result: "ok" });
    await expect(checkPin({ ...row, locked_until: later(10) }, "1234", recipient())).resolves.toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("try_pin", {
      p_token: row.token,
      p_recipient: "recipient-a",
      p_candidate: hashPin(row.token, "1234"),
      p_max: MAX_PIN_ATTEMPTS,
      p_lock_minutes: LOCK_MINUTES,
      p_hard_after: HARD_LOCK_AFTER,
    });
  });

  test("shared-link handoffs are counted on the handoff row", async () => {
    replies({ result: "wrong_pin", attempts_left: 2 });
    await expect(checkPin(row, "0000")).resolves.toEqual({ ok: false, status: "wrong_pin", attemptsLeft: 2 });
    expect(rpc.mock.calls[0][1]).toMatchObject({ p_recipient: null });
  });

  test("a malformed PIN still counts as a wrong attempt, without a hash", async () => {
    replies({ result: "wrong_pin", attempts_left: 1 });
    await checkPin(row, "12ab", recipient());
    expect(rpc.mock.calls[0][1]).toMatchObject({ p_candidate: null });
  });

  test("a missing PIN asks for one and is not counted", async () => {
    await expect(checkPin(row, "", recipient())).resolves.toEqual({ ok: false, status: "pin_required" });
    expect(rpc).not.toHaveBeenCalled();
  });

  test("every attempt, including parallel ones, goes to try_pin; none is decided from the stale row", async () => {
    replies({ result: "wrong_pin", attempts_left: 2 }, { result: "wrong_pin", attempts_left: 1 }, { result: "locked", locked_until: later(10) }, { result: "locked", locked_until: later(10) }, { result: "locked", locked_until: later(10) });
    const stale = recipient();
    const results = await Promise.all(["0000", "0001", "0002", "0003", "1234"].map((pin) => checkPin(row, pin, stale)));
    expect(rpc).toHaveBeenCalledTimes(5);
    expect(results.filter((r) => !r.ok && r.status === "locked")).toHaveLength(3);
    expect(results.some((r) => r.ok)).toBe(false);
  });
});

describe("lock message", () => {
  test("says how long, or who can unlock it", () => {
    expect(COPY.pinLocked(later(10))).toBe("Too many attempts. Try again in 10 minutes.");
    expect(COPY.pinLocked(later(0.5))).toBe("Too many attempts. Try again in 1 minute.");
    expect(COPY.pinLocked(null)).toBe("Too many attempts. Ask the person who shared this with you to unlock your link.");
  });
});
