import "server-only";
import { cache } from "react";
import type { Actor } from "@/lib/auth";
import { canHoldKeys, encodeKey, newCircleKey, openCircleKey as openStored, sealCircleKey } from "@/lib/key-custody";
import { can } from "@/lib/permissions";
import { HELD_CIRCLE_KEY, type CircleKeyState } from "@/lib/schema/circles";
import { clientFor } from "@/store/db";

/**
 * A circle's key for files (docs/decisions/0015-file-encryption.md). All Hands Care keeps it,
 * wrapped, and hands it to the circle's caregiver after sign-in. Every function here first checks
 * that the actor is that caregiver; each read and write then goes through the caregiver's own
 * session, so row security checks the same thing again. People with a link never reach a key.
 *
 * Keys are returned to the caller and never logged.
 */

const unavailable = "Saved summaries cannot be opened right now. Try again in a little while.";
const notYours = "Only the caregiver can open saved summaries.";
const notFound = "That circle was not found.";

type Caregiver = Extract<Actor, { kind: "caregiver" }>;

function isKeyHolder(actor: Actor, circleId: string): actor is Caregiver {
  return actor.kind === "caregiver" && actor.role === "owner" && actor.circleIds.includes(circleId) && can(actor, "circle:rotate_key", { circleId });
}

type Stored = { keyVersion: number; wrapped: string | null; wrappedVersion: number };

async function readStored(actor: Caregiver, circleId: string): Promise<Stored | null> {
  const db = clientFor(actor);
  const [circle, own] = await Promise.all([
    db.from("circles").select("key_version").eq("id", circleId).is("deleted_at", null).maybeSingle(),
    db.from("circle_caregivers").select("circle_key_wrapped, key_version").eq("circle_id", circleId).eq("user_id", actor.userId).maybeSingle(),
  ]);
  if (circle.error || !circle.data || own.error || !own.data) return null;
  return {
    keyVersion: circle.data.key_version as number,
    wrapped: (own.data.circle_key_wrapped as string | null) ?? null,
    wrappedVersion: own.data.key_version as number,
  };
}

/** Where the circle's key stands. Null for anyone but the circle's caregiver. Holds no key material. */
export const getCircleKeyState = cache(async function getCircleKeyState(actor: Actor, circleId: string): Promise<CircleKeyState | null> {
  if (!isKeyHolder(actor, circleId)) return null;
  const stored = await readStored(actor, circleId);
  if (!stored) return null;
  return { keyVersion: stored.keyVersion, state: stored.wrapped ? "held" : "none" };
});

/**
 * Hands the caregiver their circle's key, base64url. A circle with no key gets one here, the
 * first time it is needed. A stored key that does not open is never replaced from here: it may
 * open again once the server's secret is put right.
 */
export async function openCircleKey(actor: Actor, circleId: string): Promise<{ ok: true; key: string; keyVersion: number } | { ok: false; error: string }> {
  if (!isKeyHolder(actor, circleId)) return { ok: false, error: notYours };
  if (!canHoldKeys()) return { ok: false, error: unavailable };
  const stored = await readStored(actor, circleId);
  if (!stored) return { ok: false, error: notFound };
  if (stored.wrapped) return release(stored, circleId);
  return createFirst(actor, circleId, stored);
}

function release(stored: Stored, circleId: string): { ok: true; key: string; keyVersion: number } | { ok: false; error: string } {
  if (!stored.wrapped || !HELD_CIRCLE_KEY.test(stored.wrapped) || stored.wrappedVersion !== stored.keyVersion) return { ok: false, error: unavailable };
  try {
    return { ok: true, key: encodeKey(openStored(stored.wrapped, circleId, stored.keyVersion)), keyVersion: stored.keyVersion };
  } catch {
    return { ok: false, error: unavailable };
  }
}

async function createFirst(actor: Caregiver, circleId: string, stored: Stored): Promise<{ ok: true; key: string; keyVersion: number } | { ok: false; error: string }> {
  const raw = newCircleKey();
  const wrapped = sealCircleKey(raw, circleId, stored.keyVersion);
  // Only fills an empty place, so two devices asking at once end up with the same key.
  const saved = await clientFor(actor)
    .from("circle_caregivers")
    .update({ circle_key_wrapped: wrapped, key_version: stored.keyVersion })
    .eq("circle_id", circleId)
    .eq("user_id", actor.userId)
    .is("circle_key_wrapped", null)
    .select("user_id")
    .maybeSingle();
  if (saved.error) return { ok: false, error: unavailable };
  if (saved.data) return { ok: true, key: encodeKey(raw), keyVersion: stored.keyVersion };
  const again = await readStored(actor, circleId);
  return again ? release(again, circleId) : { ok: false, error: unavailable };
}
