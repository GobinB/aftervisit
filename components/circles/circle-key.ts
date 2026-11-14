"use client";

import { handOverCircleKeyAction, openCircleKeyAction, startFreshCircleKeyAction } from "@/app/actions/circle-keys";
import { base64UrlToBytes, bytesToBase64Url } from "@/lib/crypto/bytes";
import { exportKeyBytes } from "@/lib/crypto/export";
import { loadCircleKey, saveCircleKey } from "@/lib/crypto/idb";
import { importCircleKey, openWithWords } from "@/lib/crypto/keys";
import type { CircleKeyState } from "@/lib/schema/circles";

/** A key made with recovery words that this device does not have. `wrapped` is what the words open, when they still can. */
export type OldKey = { wrapped: string | null; keyVersion: number; savedFiles: number };

export type CircleKeyResult =
  | { ok: true; key: CryptoKey; keyVersion: number }
  | { ok: false; reason: "words"; old: OldKey }
  | { ok: false; reason: "failed"; error: string };

const offline = "Check the connection and try again.";
const running = new Map<string, Promise<CircleKeyResult>>();

/**
 * The circle's key for files, ready to use on this device, with nothing for the caregiver to do.
 * A copy kept on this device is used when it is the one All Hands Care holds. Otherwise the
 * server hands the key over (making one for a circle that has none), and it is kept here for
 * next time. Signing out clears the copy; signing in again brings it back the same way.
 *
 * One case is not silent: a key made with recovery words, on a device that does not have it.
 * A device that does have it gives it to the server here, so no other device ever has to ask.
 */
export function ensureCircleKey(circleId: string, known?: CircleKeyState | null): Promise<CircleKeyResult> {
  const current = running.get(circleId);
  if (current) return current;
  const next = find(circleId, known ?? null).finally(() => running.delete(circleId));
  running.set(circleId, next);
  return next;
}

async function find(circleId: string, known: CircleKeyState | null): Promise<CircleKeyResult> {
  const local = await loadCircleKey(circleId).catch(() => null);
  if (local && known?.state === "held" && local.keyVersion === known.keyVersion) return { ok: true, key: local.key, keyVersion: local.keyVersion };
  let opened: Awaited<ReturnType<typeof openCircleKeyAction>>;
  try {
    opened = await openCircleKeyAction(circleId);
  } catch {
    return { ok: false, reason: "failed", error: offline };
  }
  if (!opened.ok) return { ok: false, reason: "failed", error: opened.error };
  if (opened.state === "ready") return keep(circleId, opened.key, opened.keyVersion);
  if (local && local.keyVersion === opened.keyVersion && (await handOver(circleId, local.key, local.keyVersion))) {
    return { ok: true, key: local.key, keyVersion: local.keyVersion };
  }
  return { ok: false, reason: "words", old: { wrapped: opened.wrapped, keyVersion: opened.keyVersion, savedFiles: opened.savedFiles } };
}

async function keep(circleId: string, encoded: string, keyVersion: number): Promise<CircleKeyResult> {
  try {
    const key = await importCircleKey(base64UrlToBytes(encoded));
    // A browser that cannot store it (private browsing) still works: the key is asked for again next time.
    await saveCircleKey(circleId, key, keyVersion).catch(() => undefined);
    return { ok: true, key, keyVersion };
  } catch {
    return { ok: false, reason: "failed", error: "Saved photos cannot be opened in this browser." };
  }
}

async function handOver(circleId: string, key: CryptoKey, keyVersion: number): Promise<boolean> {
  try {
    const raw = await exportKeyBytes(key);
    const result = await handOverCircleKeyAction({ circleId, key: bytesToBase64Url(raw), keyVersion });
    return result.ok;
  } catch {
    return false;
  }
}

/** "I still have my words": opens the old key with them on this device, then hands the key over. The words are not sent. */
export async function openOldKeyWithWords(circleId: string, old: OldKey, words: string): Promise<CircleKeyResult> {
  if (!old.wrapped) return { ok: false, reason: "failed", error: "Those words cannot open this circle's saved photos any more." };
  let key: CryptoKey;
  try {
    key = await openWithWords(old.wrapped, words);
  } catch (caught) {
    const message = caught instanceof Error && /12 words|did not open/.test(caught.message) ? caught.message : "Those words did not open the saved photos.";
    return { ok: false, reason: "failed", error: message };
  }
  if (!(await handOver(circleId, key, old.keyVersion))) return { ok: false, reason: "failed", error: "The words are right, but the photos could not be opened just now. Try again." };
  await saveCircleKey(circleId, key, old.keyVersion).catch(() => undefined);
  return { ok: true, key, keyVersion: old.keyVersion };
}

/** "Start fresh": the saved photos that need the lost words are removed, and the circle gets a new key. */
export async function startFresh(circleId: string): Promise<CircleKeyResult> {
  let result: Awaited<ReturnType<typeof startFreshCircleKeyAction>>;
  try {
    result = await startFreshCircleKeyAction(circleId);
  } catch {
    return { ok: false, reason: "failed", error: offline };
  }
  if (!result.ok) return { ok: false, reason: "failed", error: result.error };
  return keep(circleId, result.key, result.keyVersion);
}
