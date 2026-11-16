"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getActor } from "@/lib/auth";
import { explainCreateFailure } from "@/lib/circle-form";
import { CircleContentSchema, CreateCircleSchema, TimeZoneSchema } from "@/lib/schema/circles";
import { createCircle as create, deleteCircle as remove, setCircleTimeZone, updateCircleContent } from "@/services/circles";

export async function createCircle(input: unknown) {
  const parsed = CreateCircleSchema.safeParse(input);
  if (!parsed.success) {
    const failure = explainCreateFailure(parsed.error);
    return { ok: false as const, error: failure.error, step: failure.step };
  }
  const actor = await getActor();
  if (!actor) return { ok: false as const, error: "Sign in to continue." };
  return create(actor, parsed.data);
}

export async function deleteCircle(circleId: string) {
  const parsed = z.string().uuid().safeParse(circleId);
  if (!parsed.success) return { ok: false as const, error: "That circle was not found." };
  const actor = await getActor(parsed.data);
  if (!actor) return { ok: false as const, error: "Sign in to continue." };
  const result = await remove(actor, parsed.data);
  if (!result.ok) return result;
  redirect("/circles");
}

const SaveSummarySchema = z.object({ circleId: z.string().uuid(), content: CircleContentSchema }).strict();

/** Saves the care summary: allergies, doctors, pharmacy, who to call. Added any time after the circle starts. */
export async function saveCareSummary(input: unknown) {
  const parsed = SaveSummarySchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Check the details and try again." };
  const actor = await getActor(parsed.data.circleId);
  if (!actor) return { ok: false as const, error: "Sign in to continue." };
  const result = await updateCircleContent(actor, parsed.data.circleId, parsed.data.content);
  if (result.ok) {
    for (const path of ["", "/summary", "/medications", "/emergency"]) revalidatePath(`/circles/${parsed.data.circleId}${path}`);
  }
  return result;
}

const TimeZoneInputSchema = z.object({ circleId: z.string().uuid(), timeZone: TimeZoneSchema, replace: z.boolean().optional() }).strict();

/** Records the circle's time zone from the caregiver's device: once on its own, or replaced from the subscribe page. */
export async function setTimeZoneAction(input: unknown) {
  const parsed = TimeZoneInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "That time zone was not recognized." };
  const actor = await getActor(parsed.data.circleId);
  if (!actor) return { ok: false as const, error: "Sign in to continue." };
  const result = await setCircleTimeZone(actor, parsed.data.circleId, parsed.data.timeZone, !parsed.data.replace);
  if (result.ok && parsed.data.replace) revalidatePath(`/circles/${parsed.data.circleId}`, "layout");
  return result;
}
