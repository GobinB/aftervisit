"use server";

import "server-only";
import { z } from "zod";
import { getActor } from "@/lib/auth";
import { RATE_LIMITS } from "@/lib/env";
import { checkActorRateLimit } from "@/lib/ratelimit";
import { openCircleKey } from "@/services/circle-keys";

/**
 * Hands the signed-in caregiver their circle's key for files, making one if the circle has none.
 * Counted against an hourly limit per account. The service checks again that they are this
 * circle's caregiver. Nothing here is logged.
 */
export async function openCircleKeyAction(circleId: unknown) {
  const parsed = z.string().uuid().safeParse(circleId);
  if (!parsed.success) return { ok: false as const, error: "That circle was not found." };
  const actor = await getActor(parsed.data);
  if (!actor || actor.kind !== "caregiver") return { ok: false as const, error: "Sign in to continue." };
  if (!(await checkActorRateLimit(actor.userId, "circle-key", RATE_LIMITS.circleKey))) {
    return { ok: false as const, error: "Too many tries in a short time. Wait a few minutes, then try again." };
  }
  return openCircleKey(actor, parsed.data);
}
