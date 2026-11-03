"use server";

import "server-only";
import { redirect } from "next/navigation";
import { z } from "zod";
import { setHelperSession } from "@/lib/auth";
import { openMemberToken } from "@/services/members";

const OpenSchema = z.object({
  token: z.string().regex(/^[A-Za-z0-9_-]{24}$/),
  pin: z.string().regex(/^\d{4}$/).optional(),
});

/**
 * Opens a member link. There is no actor yet: this is what creates the helper cookie.
 * The member row is checked here, including the per-link PIN lockout.
 */
export async function openMemberLink(input: unknown) {
  const raw =
    input instanceof FormData
      ? { token: input.get("token"), pin: String(input.get("pin") ?? "") || undefined }
      : input;
  const parsed = OpenSchema.safeParse(raw);
  if (!parsed.success) return { ok: false as const, error: "This link is not valid." };
  const result = await openMemberToken(parsed.data.token, parsed.data.pin);
  if (!result.ok) return result;
  const saved = await setHelperSession({ memberId: result.memberId, circleId: result.circleId, role: result.role });
  if (!saved) return { ok: false as const, error: "Helper sign-in is not set up yet." };
  redirect(`/circles/${result.circleId}`);
}
