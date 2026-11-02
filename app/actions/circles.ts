"use server";

import "server-only";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getActor } from "@/lib/auth";
import { CreateCircleSchema, RotateCircleKeySchema, StoreCircleKeySchema } from "@/lib/schema/circles";
import { createCircle as create, deleteCircle as remove, rotateCircleKey as rotate, storeOwnCircleKey as storeKey } from "@/services/circles";

export async function createCircle(input: unknown) {
  const parsed = CreateCircleSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Check the form and try again." };
  const actor = await getActor();
  if (!actor) return { ok: false as const, error: "Sign in to continue." };
  return create(actor, parsed.data);
}

/** Saves a wrapped key on the signed-in caregiver's row. The phrase is not an input. */
export async function storeCircleKey(input: unknown) {
  const parsed = StoreCircleKeySchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "The key could not be saved. Try again." };
  const actor = await getActor(parsed.data.circleId);
  if (!actor) return { ok: false as const, error: "Sign in to continue." };
  return storeKey(actor, parsed.data.circleId, parsed.data.circleKeyWrapped, parsed.data.keyVersion);
}

/** Bumps the circle key version and returns new member tokens. The browser adds the key fragment itself. */
export async function rotateCircleKey(input: unknown) {
  const parsed = RotateCircleKeySchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "The key could not be changed. Try again." };
  const actor = await getActor(parsed.data.circleId);
  if (!actor) return { ok: false as const, error: "Sign in to continue." };
  return rotate(actor, parsed.data.circleId, parsed.data.circleKeyWrapped, parsed.data.keyVersion);
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
