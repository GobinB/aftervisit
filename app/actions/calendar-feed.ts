"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getActor } from "@/lib/auth";
import { setFeedMedicines, startFeed, stopFeed } from "@/services/calendar-feed";

const Input = z.object({ circleId: z.string().uuid() }).strict();

/** Turns on the circle's calendar link, or makes a new one in place of the old. */
export async function startFeedAction(input: unknown) {
  const parsed = Input.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "That circle was not found." };
  const actor = await getActor(parsed.data.circleId);
  if (!actor) return { ok: false as const, error: "Sign in to continue." };
  const result = await startFeed(actor, parsed.data.circleId);
  if (result.ok) revalidatePath(`/circles/${parsed.data.circleId}/calendar/subscribe`);
  return result;
}

export async function stopFeedAction(input: unknown) {
  const parsed = Input.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "That circle was not found." };
  const actor = await getActor(parsed.data.circleId);
  if (!actor) return { ok: false as const, error: "Sign in to continue." };
  const result = await stopFeed(actor, parsed.data.circleId);
  if (result.ok) revalidatePath(`/circles/${parsed.data.circleId}/calendar/subscribe`);
  return result;
}

const MedicinesInput = z.object({ circleId: z.string().uuid(), include: z.boolean() }).strict();

/** Puts medicine times into the calendar link, or leaves them out. */
export async function setFeedMedicinesAction(input: unknown) {
  const parsed = MedicinesInput.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "That circle was not found." };
  const actor = await getActor(parsed.data.circleId);
  if (!actor) return { ok: false as const, error: "Sign in to continue." };
  const result = await setFeedMedicines(actor, parsed.data.circleId, parsed.data.include);
  if (result.ok) revalidatePath(`/circles/${parsed.data.circleId}/calendar/subscribe`);
  return result;
}
