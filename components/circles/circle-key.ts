"use client";

import { openCircleKeyAction } from "@/app/actions/circle-keys";
import { base64UrlToBytes } from "@/lib/crypto/bytes";
import { loadCircleKey, saveCircleKey } from "@/lib/crypto/idb";
import { importCircleKey } from "@/lib/crypto/keys";
import type { CircleKeyState } from "@/lib/schema/circles";

export type CircleKeyResult = { ok: true; key: CryptoKey; keyVersion: number } | { ok: false; error: string };

const running = new Map<string, Promise<CircleKeyResult>>();

/**
 * The circle's key for files, ready to use on this device, with nothing for the caregiver to do.
 * A copy kept on this device is used while it matches the key All Hands Care holds. Otherwise the
 * server hands the key over (making one for a circle that has none), and it is kept here for next
 * time. Signing out clears the copy; signing in again brings it back the same way.
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
    return { ok: false, error: "Check the connection and try again." };
  }
  if (!opened.ok) return opened;
  try {
    const key = await importCircleKey(base64UrlToBytes(opened.key));
    // A browser that cannot store it (private browsing) still works: the key is asked for again next time.
    await saveCircleKey(circleId, key, opened.keyVersion).catch(() => undefined);
    return { ok: true, key, keyVersion: opened.keyVersion };
  } catch {
    return { ok: false, error: "Saved summaries cannot be opened in this browser." };
  }
}
