"use client";

import { exportKeyBytes } from "@/lib/crypto/export";
import { loadCircleKey } from "@/lib/crypto/idb";
import { buildHelperLink } from "@/lib/crypto/link";

/** Builds /i/{token}#k=... on this device. The token is the only part a server action returned. */
export async function urlForMemberToken(circleId: string, token: string): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  try {
    const local = await loadCircleKey(circleId);
    if (!local) {
      return { ok: false, error: "This browser does not have the key for this circle. Enter the recovery words, then create the link again." };
    }
    const raw = await exportKeyBytes(local.key);
    return { ok: true, url: buildHelperLink(window.location.origin, token, raw) };
  } catch {
    return { ok: false, error: "The link could not be prepared on this device. Try again." };
  }
}
