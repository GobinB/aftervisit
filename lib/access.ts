import "server-only";
import { NextResponse } from "next/server";
import { db, getHandoff, getTombstone, isExpired, type HandoffRow } from "./db";
import type { RecipientRow } from "./invites";
import { PinSchema } from "./schema";
import { hashManageKey, hashPin, hashToken, MANAGE_KEY_RE, safeEqual, TOKEN_RE } from "./tokens";

export const MAX_PIN_ATTEMPTS = 3;
/** The first lock lasts this long; each later one doubles (shared links cap at 24 hours). */
export const LOCK_MINUTES = 10;
/** The third lock on a personal link lasts until the creator unlocks it. */
export const HARD_LOCK_AFTER = 3;

export function json(data: unknown, status = 200, headers: Record<string, string> = {}) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", ...headers },
  });
}

export type Lookup =
  | { status: "ok"; row: HandoffRow }
  | { status: "expired" | "deleted" | "not_found" | "invite_only" };

/**
 * Finds a live handoff. Expired rows are never served, even between purge runs.
 * Handoffs shared with personal links are not readable through the general link at all,
 * unless `forCreator` (the manage-key routes, which check the key themselves).
 */
export async function lookup(token: string, opts: { forCreator?: boolean } = {}): Promise<Lookup> {
  if (!TOKEN_RE.test(token)) return { status: "not_found" };
  const row = await getHandoff(token);
  if (row && row.access_mode === "invite" && !opts.forCreator) return isExpired(row) ? { status: "expired" } : { status: "invite_only" };
  if (row) return isExpired(row) ? { status: "expired" } : { status: "ok", row };
  const gone = await getTombstone(hashToken(token));
  return gone ? { status: gone } : { status: "not_found" };
}

export function goneResponse(status: "expired" | "deleted" | "not_found" | "invite_only" | "revoked") {
  return json({ status }, status === "not_found" || status === "invite_only" ? 404 : 410);
}

/** For caregiver-only routes: the handoff, if the x-manage-key header matches. */
export async function requireManage(req: Request, token: string): Promise<{ row: HandoffRow } | { res: Response }> {
  const key = req.headers.get("x-manage-key") ?? "";
  if (!MANAGE_KEY_RE.test(key)) return { res: json({ status: "forbidden" }, 403) };
  const found = await lookup(token, { forCreator: true });
  if (found.status !== "ok") return { res: goneResponse(found.status) };
  if (!safeEqual(hashManageKey(key), found.row.manage_key_hash)) return { res: json({ status: "forbidden" }, 403) };
  return { row: found.row };
}

export type PinCheck =
  | { ok: true }
  | { ok: false; status: "pin_required" }
  /** lockedUntil null: locked until the creator unlocks the link. */
  | { ok: false; status: "locked"; lockedUntil: string | null }
  | { ok: false; status: "wrong_pin"; attemptsLeft: number };

/** The lock still in force on a stored `locked_until`, if any. */
export function activeLock(lockedUntil: string | null | undefined, now = Date.now()): { lockedUntil: string | null } | null {
  if (!lockedUntil) return null;
  if (lockedUntil === "infinity") return { lockedUntil: null };
  return Date.parse(lockedUntil) > now ? { lockedUntil } : null;
}

export interface TryPinRow {
  result: "ok" | "wrong_pin" | "locked" | "not_found";
  locked_until: string | null;
  attempts_left: number | null;
}

/** Maps a try_pin row (migration 0003) to the response the routes send. */
export function toPinCheck(r: TryPinRow): PinCheck {
  switch (r.result) {
    case "ok":
      return { ok: true };
    case "wrong_pin":
      return { ok: false, status: "wrong_pin", attemptsLeft: r.attempts_left ?? 0 };
    case "locked":
      return { ok: false, status: "locked", lockedUntil: r.locked_until === "infinity" ? null : r.locked_until };
    default:
      throw new Error(`try_pin: ${r.result}`);
  }
}

/**
 * Verifies a PIN. The lockout is per personal link (or per handoff for older shared links) and is
 * decided by try_pin in the database, one attempt at a time, so parallel guesses cannot get past it.
 * The PIN only ever arrives in a POST body, never in a URL.
 */
export async function checkPin(row: HandoffRow, pin: unknown, recipient?: RecipientRow): Promise<PinCheck> {
  if (!row.pin_hash) return { ok: true };
  const lock = activeLock(recipient ? recipient.locked_until : row.locked_until);
  if (lock) return { ok: false, status: "locked", ...lock };
  if (pin === undefined || pin === null || pin === "") return { ok: false, status: "pin_required" };
  const parsed = PinSchema.safeParse(pin);
  const { data, error } = await db()
    .rpc("try_pin", {
      p_token: row.token,
      p_recipient: recipient?.id ?? null,
      p_candidate: parsed.success ? hashPin(row.token, parsed.data) : null,
      p_max: MAX_PIN_ATTEMPTS,
      p_lock_minutes: LOCK_MINUTES,
      p_hard_after: HARD_LOCK_AFTER,
    })
    .single<TryPinRow>();
  if (error) throw error;
  return toPinCheck(data);
}

export function pinFailureResponse(check: Exclude<PinCheck, { ok: true }>) {
  return json(check, check.status === "locked" ? 423 : 401);
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const body = await req.json();
    return body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
