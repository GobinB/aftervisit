"use server";

import { cleanPhone } from "@/lib/phone";
import "server-only";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getActor } from "@/lib/auth";
import { explainCreateFailure } from "@/lib/circle-form";
import { CircleContentSchema, CreateCircleSchema, TimeZoneSchema } from "@/lib/schema/circles";
import { changeEmergencyContacts, createCircle as create, deleteCircle as remove, setCircleTimeZone, updateCircleContent } from "@/services/circles";

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

const AddContactSchema = z
  .object({ circleId: z.string().uuid(), name: z.string().trim().min(1).max(80), relationship: z.string().trim().max(80).optional(), phone: z.string().max(40).optional() })
  .strict();
const RemoveContactSchema = z.object({ circleId: z.string().uuid(), index: z.number().int().min(0).max(19), name: z.string().max(80) }).strict();

/** Adds one emergency contact from the Emergency page: a name, who they are, and a number. */
export async function addEmergencyContactAction(input: unknown) {
  const parsed = AddContactSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Type their name." };
  const phone = cleanPhone(parsed.data.phone);
  if (!phone.ok) return { ok: false as const, error: phone.error };
  const actor = await getActor(parsed.data.circleId);
  if (!actor) return { ok: false as const, error: "Sign in to continue." };
  const result = await changeEmergencyContacts(actor, parsed.data.circleId, {
    add: { name: parsed.data.name, relationship: parsed.data.relationship || undefined, phone: phone.phone ?? undefined },
  });
  if (result.ok) revalidatePath(`/circles/${parsed.data.circleId}`, "layout");
  return result;
}

/** Removes one emergency contact from the Emergency page. */
export async function removeEmergencyContactAction(input: unknown) {
  const parsed = RemoveContactSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "That contact was not found." };
  const actor = await getActor(parsed.data.circleId);
  if (!actor) return { ok: false as const, error: "Sign in to continue." };
  const result = await changeEmergencyContacts(actor, parsed.data.circleId, { remove: { index: parsed.data.index, name: parsed.data.name } });
  if (result.ok) revalidatePath(`/circles/${parsed.data.circleId}`, "layout");
  return result;
}
