import "server-only";
import { NextResponse } from "next/server";
import { db, getHandoff, getTombstone, isExpired, type HandoffRow } from "./db";
import { PinSchema } from "./schema";
import { hashPin, hashToken, safeEqual, TOKEN_RE } from "./tokens";

export const MAX_PIN_ATTEMPTS = 3;
export const LOCK_MINUTES = 10;

export function json(data: unknown, status = 200, headers: Record<string, string> = {}) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", ...headers },
  });
}

export type Lookup =
  | { status: "ok"; row: HandoffRow }
  | { status: "expired" | "deleted" | "not_found" };

/** Finds a live handoff. Expired rows are never served, even between purge runs. */
export async function lookup(token: string): Promise<Lookup> {
  if (!TOKEN_RE.test(token)) return { status: "not_found" };
  const row = await getHandoff(token);
  if (row) return isExpired(row) ? { status: "expired" } : { status: "ok", row };
  const gone = await getTombstone(hashToken(token));
  return gone ? { status: gone } : { status: "not_found" };
}

export function goneResponse(status: "expired" | "deleted" | "not_found") {
  return json({ status }, status === "not_found" ? 404 : 410);
}

export type PinCheck =
  | { ok: true }
  | { ok: false; status: "pin_required" }
  | { ok: false; status: "locked"; lockedUntil: string }
  | { ok: false; status: "wrong_pin"; attemptsLeft: number };

/**
 * Verifies a PIN with lockout: three wrong attempts lock the handoff for ten minutes.
 * The PIN only ever arrives in a POST body, never in a URL.
 */
export async function checkPin(row: HandoffRow, pin: unknown): Promise<PinCheck> {
  if (!row.pin_hash) return { ok: true };
  if (row.locked_until && new Date(row.locked_until).getTime() > Date.now()) {
    return { ok: false, status: "locked", lockedUntil: row.locked_until };
  }
  if (pin === undefined || pin === null || pin === "") return { ok: false, status: "pin_required" };
  const parsed = PinSchema.safeParse(pin);
  if (parsed.success && safeEqual(hashPin(row.token, parsed.data), row.pin_hash)) {
    if (row.pin_failures > 0 || row.locked_until) {
      await db().from("handoffs").update({ pin_failures: 0, locked_until: null }).eq("token", row.token);
    }
    return { ok: true };
  }
  const failures = row.pin_failures + 1;
  if (failures >= MAX_PIN_ATTEMPTS) {
    const lockedUntil = new Date(Date.now() + LOCK_MINUTES * 60_000).toISOString();
    await db().from("handoffs").update({ pin_failures: 0, locked_until: lockedUntil }).eq("token", row.token);
    return { ok: false, status: "locked", lockedUntil };
  }
  await db().from("handoffs").update({ pin_failures: failures }).eq("token", row.token);
  return { ok: false, status: "wrong_pin", attemptsLeft: MAX_PIN_ATTEMPTS - failures };
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
