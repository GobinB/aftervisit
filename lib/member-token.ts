import "server-only";
import { createHmac } from "node:crypto";
import { env } from "@/lib/env";

/**
 * A person's link token, worked out from their id and their link number rather than stored, so the
 * caregiver can share the same link again from any device. The database keeps only its hash
 * (lib/invites.ts hashInvite), as before. "New link" moves the number up, which changes the token.
 *
 * Keyed by HELPER_SESSION_SECRET, the secret that already signs a person's sign-in cookie: anyone
 * with it could already act as any person, so it adds no new way in. Changing it changes every link.
 */
export function memberToken(memberId: string, linkVersion: number): string | null {
  const secret = env.helperSessionSecret;
  if (!secret) return null;
  return createHmac("sha256", secret).update(`ahc-member-link:${memberId}:${linkVersion}`).digest("base64url").slice(0, 24);
}
