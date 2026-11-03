import "server-only";
import { createHash } from "node:crypto";
import type { Actor } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { CONSENT_TEXT, CONSENT_TYPES, CONSENT_VERSION, CircleContentSchema, type CircleContent, type CreateCircleInput } from "@/lib/schema/circles";
import { clientFor } from "@/store/db";

const generic = "That could not be saved. Try again.";

function textHash(type: (typeof CONSENT_TYPES)[number]): string {
  return createHash("sha256").update(`${CONSENT_VERSION}\n${CONSENT_TEXT[type]}`).digest("hex");
}

export async function createCircle(actor: Actor, input: CreateCircleInput): Promise<{ ok: true; circleId: string } | { ok: false; error: string }> {
  if (actor.kind !== "caregiver") return { ok: false, error: "Sign in with Google to create a circle." };
  const db = clientFor(actor);
  const { data, error } = await db.from("circles").insert({ owner_id: actor.userId, key_version: 1, content: input.content }).select("id").single();
  if (error || !data) return { ok: false, error: generic };
  const circleId = data.id as string;
  const caregiver = await db.from("circle_caregivers").insert({ circle_id: circleId, user_id: actor.userId, role: "owner", key_version: 1 });
  if (caregiver.error) {
    await db.from("circles").delete().eq("id", circleId);
    return { ok: false, error: generic };
  }
  const agreed_at = new Date().toISOString();
  const consents = await db.from("consents").insert(
    CONSENT_TYPES.map((type) => ({
      circle_id: circleId,
      user_id: actor.userId,
      type,
      version: CONSENT_VERSION,
      text_hash: textHash(type),
      agreed_at,
    })),
  );
  if (consents.error) {
    await db.from("circles").delete().eq("id", circleId);
    return { ok: false, error: generic };
  }
  await db.from("activity").insert({
    circle_id: circleId,
    actor: `caregiver:${actor.userId}`,
    action: "circle_created",
    subject_type: "circle",
    subject_id: circleId,
  });
  return { ok: true, circleId };
}

export async function deleteCircle(actor: Actor, circleId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!can(actor, "circle:delete", { circleId })) return { ok: false, error: "Only the owner can delete a circle." };
  const db = clientFor(actor);
  await db.from("activity").insert({
    circle_id: circleId,
    actor: actor.kind === "caregiver" ? `caregiver:${actor.userId}` : "member",
    action: "circle_deleted",
    subject_type: "circle",
    subject_id: circleId,
  });
  const { error } = await db.from("circles").update({ deleted_at: new Date().toISOString() }).eq("id", circleId).is("deleted_at", null);
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

export async function getCircle(actor: Actor, circleId: string): Promise<CircleContent | null> {
  if (actor.kind === "helper" && actor.circleId !== circleId) return null;
  if (actor.kind === "caregiver" && !actor.circleIds.includes(circleId)) return null;
  if (!can(actor, "summary:read", { circleId })) return null;
  const { data, error } = await clientFor(actor).from("circles").select("content").eq("id", circleId).is("deleted_at", null).maybeSingle();
  if (error || !data) return null;
  const parsed = CircleContentSchema.safeParse(data.content);
  return parsed.success ? parsed.data : null;
}
