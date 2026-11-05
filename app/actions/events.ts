"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { getActor } from "@/lib/auth";
import { EventChangeSchema, EventInputSchema } from "@/lib/schema/events";
import { deleteEvent, goToEvent, saveEvent } from "@/services/events";

function refresh(circleId: string) {
  revalidatePath(`/circles/${circleId}`);
  revalidatePath(`/circles/${circleId}/calendar`);
}

export async function saveEventAction(input: unknown) {
  const parsed = EventInputSchema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { ok: false as const, error: first?.code === "custom" || first?.path[0] === "title" ? (first.message ?? "Check the form.") : "Check the form and try again." };
  }
  const actor = await getActor(parsed.data.circleId);
  if (!actor) return { ok: false as const, error: "Open your link again to continue." };
  const result = await saveEvent(actor, parsed.data);
  if (result.ok) refresh(parsed.data.circleId);
  return result;
}

export async function goToEventAction(input: unknown) {
  const parsed = EventChangeSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Check the form and try again." };
  const actor = await getActor(parsed.data.circleId);
  if (!actor) return { ok: false as const, error: "Open your link again to continue." };
  const result = await goToEvent(actor, parsed.data.circleId, parsed.data.id);
  refresh(parsed.data.circleId);
  return result;
}

export async function deleteEventAction(input: unknown) {
  const parsed = EventChangeSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Check the form and try again." };
  const actor = await getActor(parsed.data.circleId);
  if (!actor) return { ok: false as const, error: "Sign in to continue." };
  const result = await deleteEvent(actor, parsed.data.circleId, parsed.data.id);
  if (result.ok) refresh(parsed.data.circleId);
  return result;
}
