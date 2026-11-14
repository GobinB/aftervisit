"use client";

import { ensureCircleKey } from "@/components/circles/circle-key";
import { exportKeyBytes } from "@/lib/crypto/export";
import { buildHelperLink } from "@/lib/crypto/link";
import type { CircleKeyState } from "@/lib/schema/circles";

/**
 * Builds a person's link on this device. The circle's key for files rides after # (the address a
 * browser sends to a server stops before it). A circle that has no key yet gets one here. If the
 * key cannot be had just now, the link is /i/{token} alone: it opens everything the person may
 * see, so making a link never fails over the key.
 */
export async function urlForMemberToken(circleId: string, token: string, known: CircleKeyState | null): Promise<{ ok: true; url: string; withKey: boolean }> {
  const plain = `${window.location.origin}/i/${token}`;
  try {
    const found = await ensureCircleKey(circleId, known);
    if (!found.ok) return { ok: true, url: plain, withKey: false };
    const raw = await exportKeyBytes(found.key);
    return { ok: true, url: buildHelperLink(window.location.origin, token, raw), withKey: true };
  } catch {
    return { ok: true, url: plain, withKey: false };
  }
}
