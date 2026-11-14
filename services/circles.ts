import "server-only";
import { createHash } from "node:crypto";
import { cache } from "react";
import type { Actor } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { CONSENT_TEXT, CONSENT_TYPES, CONSENT_VERSION, CircleContentSchema, type CircleContent, type CreateCircleInput } from "@/lib/schema/circles";
import { clientFor, createCircleRecord } from "@/store/db";

const generic = "That could not be saved. Try again.";

function textHash(type: (typeof CONSENT_TYPES)[number]): string {
  return createHash("sha256").update(`${CONSENT_VERSION}\n${CONSENT_TEXT[type]}`).digest("hex");
}

export async function createCircle(actor: Actor, input: CreateCircleInput): Promise<{ ok: true; circleId: string } | { ok: false; error: string }> {
  if (actor.kind !== "caregiver") return { ok: false, error: "Sign in with Google to create a circle." };
  try {
    const circleId = await createCircleRecord(actor, {
      content: input.content,
      consents: CONSENT_TYPES.map((type) => ({
        type,
        version: CONSENT_VERSION,
        text_hash: textHash(type),
      })),
    });
    return { ok: true, circleId };
  } catch {
    return { ok: false, error: generic };
  }
}

export async function deleteCircle(actor: Actor, circleId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!can(actor, "circle:delete", { circleId })) return { ok: false, error: "Only the owner can delete a circle." };
  // One transaction: the circle, every helper link, and the activity row.
  const { error } = await clientFor(actor).rpc("delete_circle", { p_circle: circleId });
  if (error) return { ok: false, error: "The circle could not be deleted. Try again." };
  return { ok: true };
}

export async function listCircles(actor: Actor): Promise<{ id: string; personName: string }[]> {
  if (actor.kind !== "caregiver") return [];
  const { data, error } = await clientFor(actor).from("circles").select("id, content").is("deleted_at", null).order("created_at");
  if (error || !data) return [];
  return data.map((row) => {
    const parsed = CircleContentSchema.safeParse(row.content);
    return { id: row.id as string, personName: parsed.success ? parsed.data.person_name : "Circle" };
  });
}

/** Replaces the care summary. Only the caregiver may; row security checks it again. */
export async function updateCircleContent(actor: Actor, circleId: string, content: CircleContent): Promise<{ ok: true } | { ok: false; error: string }> {
  if (actor.kind !== "caregiver" || !actor.circleIds.includes(circleId) || !can(actor, "summary:edit", { circleId })) {
    return { ok: false, error: "Only the caregiver can change the care summary." };
  }
  const parsed = CircleContentSchema.safeParse(content);
  if (!parsed.success) return { ok: false, error: "Check the details and try again." };
  const { data, error } = await clientFor(actor).from("circles").update({ content: parsed.data }).eq("id", circleId).is("deleted_at", null).select("id");
  if (error || !data?.length) return { ok: false, error: generic };
  return { ok: true };
}

/** Cached per request, so the circle layout and its page share one read. */
export const getCircle = cache(async function getCircle(actor: Actor, circleId: string): Promise<CircleContent | null> {
  if (actor.kind === "helper" && actor.circleId !== circleId) return null;
  if (actor.kind === "caregiver" && !actor.circleIds.includes(circleId)) return null;
  if (!can(actor, "summary:read", { circleId })) return null;
  const { data, error } = await clientFor(actor).from("circles").select("content").eq("id", circleId).is("deleted_at", null).maybeSingle();
  if (error || !data) return null;
  const parsed = CircleContentSchema.safeParse(data.content);
  return parsed.success ? parsed.data : null;
});
