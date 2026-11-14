"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getActor } from "@/lib/auth";
import { RATE_LIMITS } from "@/lib/env";
import { checkActorRateLimit } from "@/lib/ratelimit";
import { HandOverCircleKeySchema } from "@/lib/schema/circles";
import { handOverCircleKey, openCircleKey, startFreshCircleKey } from "@/services/circle-keys";

const signIn = "Sign in to continue.";
const slowDown = "Too many tries in a short time. Wait a few minutes, then try again.";

/** The signed-in caregiver, counted against the hourly limit for anything that touches a circle key. */
async function keyActor(circleId: string) {
  const actor = await getActor(circleId);
  if (!actor || actor.kind !== "caregiver") return { ok: false as const, error: signIn };
  if (!(await checkActorRateLimit(actor.userId, "circle-key", RATE_LIMITS.circleKey))) return { ok: false as const, error: slowDown };
  return { ok: true as const, actor };
}

/**
 * Hands the signed-in caregiver their circle's key for files, making one if the circle has none.
 * The service checks again that they are this circle's caregiver. Nothing here is logged.
 */
export async function openCircleKeyAction(circleId: unknown) {
  const parsed = z.string().uuid().safeParse(circleId);
  if (!parsed.success) return { ok: false as const, error: "That circle was not found." };
  const who = await keyActor(parsed.data);
  if (!who.ok) return who;
  return openCircleKey(who.actor, parsed.data);
}

/** A device that still has a circle key made with recovery words gives it to be kept. */
export async function handOverCircleKeyAction(input: unknown) {
  const parsed = HandOverCircleKeySchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "That key could not be kept." };
  const who = await keyActor(parsed.data.circleId);
  if (!who.ok) return who;
  return handOverCircleKey(who.actor, parsed.data.circleId, parsed.data.key, parsed.data.keyVersion);
}

/** Removes the saved photos that cannot be opened without lost recovery words, and gives the circle a new key. */
export async function startFreshCircleKeyAction(circleId: unknown) {
  const parsed = z.string().uuid().safeParse(circleId);
  if (!parsed.success) return { ok: false as const, error: "That circle was not found." };
  const who = await keyActor(parsed.data);
  if (!who.ok) return who;
  const result = await startFreshCircleKey(who.actor, parsed.data);
  if (result.ok) {
    for (const path of ["", "/visits", "/summary"]) revalidatePath(`/circles/${parsed.data}${path}`);
  }
  return result;
}
