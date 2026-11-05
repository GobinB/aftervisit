"use client";

import { exportKeyBytes } from "@/lib/crypto/export";
import { loadCircleKey } from "@/lib/crypto/idb";
import { buildHelperLink } from "@/lib/crypto/link";

const missingKey = "This browser does not have the key for this circle yet. Create the key, or enter your recovery words, at the top of this page. Then try again.";
const oldKey = "This browser has an old key for this circle. Enter your recovery words at the top of this page, then try again.";

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

/**
 * Builds a person's link on this device. When this device holds the circle's current key for files,
 * it rides after # (the server never sees it). Without one, the link is /i/{token} alone: it opens
 * everything the person may see. Only files need the key, and they can be shared again once it exists.
 */
export async function urlForMemberToken(
  circleId: string,
  token: string,
  keyVersion: number | null,
): Promise<{ ok: true; url: string; withKey: boolean } | { ok: false; error: string }> {
  const plain = `${window.location.origin}/i/${token}`;
  try {
    const local = await loadCircleKey(circleId);
    if (!local || keyVersionError(local.keyVersion, keyVersion)) return { ok: true, url: plain, withKey: false };
    const raw = await exportKeyBytes(local.key);
    return { ok: true, url: buildHelperLink(window.location.origin, token, raw), withKey: true };
  } catch {
    return { ok: true, url: plain, withKey: false };
  }
}
