import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { HELPER_ROLES, type HelperRole } from "@/lib/schema/circles";

/** One browser can hold a helper session for several circles. The role in the cookie is not trusted. */
export const HELPER_COOKIE = "av_helpers";

export interface HelperClaim {
  memberId: string;
  circleId: string;
  role: HelperRole;
}

const ClaimSchema = z.object({
  memberId: z.string().uuid(),
  circleId: z.string().uuid(),
  role: z.enum(HELPER_ROLES),
});

function mac(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body).digest("base64url");
}

export function signHelperCookie(claims: HelperClaim[], secret: string): string {
  const body = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return `${body}.${mac(body, secret)}`;
}

/** Returns [] when the cookie is missing, tampered, or signed with a different secret. */
export function readHelperCookie(token: string | undefined, secret: string): HelperClaim[] {
  if (!token || !secret) return [];
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return [];
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = mac(body, secret);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return [];
  try {
    const parsed = ClaimSchema.array().max(20).safeParse(JSON.parse(Buffer.from(body, "base64url").toString()));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}
