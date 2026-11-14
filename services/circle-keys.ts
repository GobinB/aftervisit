import "server-only";
import { cache } from "react";
import type { Actor } from "@/lib/auth";
import { canHoldKeys, decodeKey, encodeKey, newCircleKey, openCircleKey as openStored, opensFileKey, sameKey, sealCircleKey } from "@/lib/key-custody";
import { can } from "@/lib/permissions";
import { HELD_CIRCLE_KEY, WORDS_WRAPPED_KEY, nextCircleKeyVersion, type CircleKeyState } from "@/lib/schema/circles";
import { countEncryptedDocuments, listEncryptedPaths, listFileKeys, removeStoredPages } from "@/services/documents";
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

function stateOf(stored: Stored): CircleKeyState["state"] {
  if (!stored.wrapped) return "none";
  if (HELD_CIRCLE_KEY.test(stored.wrapped) && stored.wrappedVersion === stored.keyVersion) return "held";
  return "words";
}

/** Where the circle's key stands. Null for anyone but the circle's caregiver. Holds no key material. */
export const getCircleKeyState = cache(async function getCircleKeyState(actor: Actor, circleId: string): Promise<CircleKeyState | null> {
  if (!isKeyHolder(actor, circleId)) return null;
  const stored = await readStored(actor, circleId);
  if (!stored) return null;
  return { keyVersion: stored.keyVersion, state: stateOf(stored) };
});

export type OpenedCircleKey =
  | { ok: true; state: "ready"; key: string; keyVersion: number }
  /** Made with recovery words, and saved summaries depend on it. `wrapped` is what the words open, when they still can. */
  | { ok: true; state: "words"; wrapped: string | null; keyVersion: number; savedFiles: number }
  | { ok: false; error: string };

/**
 * Hands the caregiver their circle's key, base64url. A circle with no key gets one here, the first
 * time it is needed. A circle whose key was made with recovery words is not opened here: the
 * caller is told so, unless nothing was ever saved with that key, in which case a new one replaces it.
 */
export async function openCircleKey(actor: Actor, circleId: string): Promise<OpenedCircleKey> {
  if (!isKeyHolder(actor, circleId)) return { ok: false, error: notYours };
  if (!canHoldKeys()) return { ok: false, error: unavailable };
  const stored = await readStored(actor, circleId);
  if (!stored) return { ok: false, error: notFound };
  const state = stateOf(stored);
  if (state === "held") return release(stored, circleId);
  if (state === "none") return createFirst(actor, circleId, stored);
  const savedFiles = await countEncryptedDocuments(actor, circleId);
  if (savedFiles == null) return { ok: false, error: unavailable };
  if (savedFiles === 0) {
    // Nothing was ever saved with the old key, so nothing is lost by replacing it.
    const replaced = await replace(actor, circleId, stored);
    if (!replaced.ok) return replaced;
    if (replaced.paths.length) await removeStoredPages(actor, circleId, replaced.paths);
    return { ok: true, state: "ready", key: replaced.key, keyVersion: replaced.keyVersion };
  }
  const usable = WORDS_WRAPPED_KEY.test(stored.wrapped ?? "") && stored.wrappedVersion === stored.keyVersion;
  return { ok: true, state: "words", wrapped: usable ? stored.wrapped : null, keyVersion: stored.keyVersion, savedFiles };
}

function release(stored: Stored, circleId: string): OpenedCircleKey {
  try {
    const raw = openStored(stored.wrapped ?? "", circleId, stored.keyVersion);
    return { ok: true, state: "ready", key: encodeKey(raw), keyVersion: stored.keyVersion };
  } catch {
    // Never replaced from here: a key that does not open today may open once the secret is put right.
    return { ok: false, error: unavailable };
  }
}

async function createFirst(actor: Caregiver, circleId: string, stored: Stored): Promise<OpenedCircleKey> {
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
  if (saved.data) return { ok: true, state: "ready", key: encodeKey(raw), keyVersion: stored.keyVersion };
  const again = await readStored(actor, circleId);
  if (again && stateOf(again) === "held") return release(again, circleId);
  return { ok: false, error: unavailable };
}

/** A new key at the next version. The database removes any encrypted summary and refuses when a key is held. */
async function replace(actor: Caregiver, circleId: string, stored: Stored): Promise<{ ok: true; state: "ready"; key: string; keyVersion: number; paths: string[] } | { ok: false; error: string }> {
  let keyVersion: number;
  try {
    keyVersion = nextCircleKeyVersion(stored.keyVersion);
  } catch {
    return { ok: false, error: unavailable };
  }
  const raw = newCircleKey();
  const wrapped = sealCircleKey(raw, circleId, keyVersion);
  const { data, error } = await clientFor(actor).rpc("reset_own_circle_key", { p_circle: circleId, p_wrapped: wrapped, p_version: keyVersion });
  if (error) return { ok: false, error: unavailable };
  const paths = Array.isArray(data) ? (data as unknown[]).filter((path): path is string => typeof path === "string") : [];
  return { ok: true, state: "ready", key: encodeKey(raw), keyVersion, paths };
}

/**
 * Keeps a circle key that a caregiver's device (or their recovery words) still had, so every
 * device gets it after sign-in from now on. It is kept only when it is right: it must open the
 * file key of every saved summary in the circle, and there must be at least one to check against.
 */
export async function handOverCircleKey(actor: Actor, circleId: string, key: string, keyVersion: number): Promise<{ ok: true } | { ok: false; error: string }> {
  const refused = "That key could not be kept.";
  if (!isKeyHolder(actor, circleId)) return { ok: false, error: notYours };
  if (!canHoldKeys()) return { ok: false, error: unavailable };
  let raw: Uint8Array;
  try {
    raw = decodeKey(key);
  } catch {
    return { ok: false, error: refused };
  }
  const stored = await readStored(actor, circleId);
  if (!stored) return { ok: false, error: notFound };
  if (keyVersion !== stored.keyVersion) return { ok: false, error: refused };
  if (stateOf(stored) === "held") {
    try {
      return sameKey(openStored(stored.wrapped ?? "", circleId, stored.keyVersion), raw) ? { ok: true } : { ok: false, error: refused };
    } catch {
      return { ok: false, error: unavailable };
    }
  }
  const files = await listFileKeys(actor, circleId);
  if (!files) return { ok: false, error: unavailable };
  if (!files.length || !files.every((file) => file.keyVersion === stored.keyVersion && opensFileKey(raw, file))) return { ok: false, error: refused };
  const wrapped = sealCircleKey(raw, circleId, stored.keyVersion);
  // Replaces only the value that was read, so two devices handing over at once cannot cross.
  const update = clientFor(actor).from("circle_caregivers").update({ circle_key_wrapped: wrapped, key_version: stored.keyVersion }).eq("circle_id", circleId).eq("user_id", actor.userId);
  const saved = await (stored.wrapped ? update.eq("circle_key_wrapped", stored.wrapped) : update.is("circle_key_wrapped", null)).select("user_id").maybeSingle();
  if (saved.error || !saved.data) return { ok: false, error: unavailable };
  return { ok: true };
}

/**
 * "Start fresh", for a circle whose key was made with recovery words that are lost. Removes the
 * saved photos and PDFs nobody can open, then gives the circle a new key. Refused when the key is
 * held, because then every saved summary opens and nothing should be removed.
 */
export async function startFreshCircleKey(
  actor: Actor,
  circleId: string,
): Promise<{ ok: true; key: string; keyVersion: number } | { ok: false; error: string }> {
  const failed = "The saved summaries could not be removed. Nothing was changed. Try again.";
  if (!isKeyHolder(actor, circleId)) return { ok: false, error: notYours };
  if (!canHoldKeys()) return { ok: false, error: unavailable };
  const stored = await readStored(actor, circleId);
  if (!stored) return { ok: false, error: notFound };
  if (stateOf(stored) !== "words") return { ok: false, error: "Saved summaries in this circle can be opened, so nothing was removed." };
  // Files first, then the rows and the key in one transaction, so nothing is left that the app cannot reach.
  const paths = await listEncryptedPaths(actor, circleId);
  if (!paths || !(await removeStoredPages(actor, circleId, paths))) return { ok: false, error: failed };
  const replaced = await replace(actor, circleId, stored);
  if (!replaced.ok) return { ok: false, error: failed };
  // A page that arrived between the two steps went with its row. Its file goes too.
  const late = replaced.paths.filter((path) => !paths.includes(path));
  if (late.length) await removeStoredPages(actor, circleId, late);
  return { ok: true, key: replaced.key, keyVersion: replaced.keyVersion };
}
