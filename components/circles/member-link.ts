"use client";

import { exportKeyBytes } from "@/lib/crypto/export";
import { loadCircleKey } from "@/lib/crypto/idb";
import { buildHelperLink } from "@/lib/crypto/link";

const missingKey = "This browser does not have the key for this circle. Enter the recovery words, then create the link again.";
const oldKey = "This browser has an old key for this circle. Enter the recovery words, then create the link again.";

/** Null when this device may build a helper link for the circle's current key. */
export function keyVersionError(localVersion: number | null, circleVersion: number | null): string | null {
  if (localVersion == null || circleVersion == null) return missingKey;
  if (localVersion !== circleVersion) return oldKey;
  return null;
}

/** Refuses a link when the key on this device is not the circle's current version. */
export function memberLinkForVersion(
  origin: string,
  token: string,
  keyBytes: Uint8Array,
  localVersion: number | null,
  circleVersion: number | null,
): { ok: true; url: string } | { ok: false; error: string } {
  const error = keyVersionError(localVersion, circleVersion);
  if (error) return { ok: false, error };
  return { ok: true, url: buildHelperLink(origin, token, keyBytes) };
}

/** Builds /i/{token}#k=... on this device. The token is the only part a server action returned. */
export async function urlForMemberToken(
  circleId: string,
  token: string,
  keyVersion: number | null,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  try {
    const local = await loadCircleKey(circleId);
    const error = keyVersionError(local?.keyVersion ?? null, keyVersion);
    if (error || !local) return { ok: false, error: error ?? missingKey };
    const raw = await exportKeyBytes(local.key);
    return { ok: true, url: buildHelperLink(window.location.origin, token, raw) };
  } catch {
    return { ok: false, error: "The link could not be prepared on this device. Try again." };
  }
}
