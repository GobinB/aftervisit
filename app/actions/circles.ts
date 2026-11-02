"use server";

import "server-only";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getActor } from "@/lib/auth";
import { CreateCircleSchema } from "@/lib/schema/circles";
import { createCircle as create, deleteCircle as remove } from "@/services/circles";

export async function createCircle(input: unknown) {
  const parsed = CreateCircleSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Check the form and try again." };
  const actor = await getActor();
  if (!actor) return { ok: false as const, error: "Sign in to continue." };
  const result = await create(actor, parsed.data);
  if (!result.ok) return result;
  redirect(`/circles/${result.circleId}`);
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
