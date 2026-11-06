import "server-only";
import { createHash } from "node:crypto";
import { cache } from "react";
import type { Actor } from "@/lib/auth";
import { hashInvite, newInviteToken } from "@/lib/invites";
import { can } from "@/lib/permissions";
import { CONSENT_TEXT, CONSENT_TYPES, CONSENT_VERSION, CircleContentSchema, nextCircleKeyVersion, type CircleContent, type CircleKeyStatus, type CreateCircleInput } from "@/lib/schema/circles";
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
      circleKeyWrapped: input.circleKeyWrapped,
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

function personName(content: unknown): string {
  const parsed = CircleContentSchema.safeParse(content);
  return parsed.success ? parsed.data.person_name : "Circle";
}

/** Wrapped keys for the signed-in caregiver only. Helpers do not have a recovery phrase. */
export async function listOwnCircleKeys(actor: Actor): Promise<CircleKeyStatus[]> {
  if (actor.kind !== "caregiver") return [];
  const db = clientFor(actor);
  const caregivers = await db.from("circle_caregivers").select("circle_id, role, circle_key_wrapped, key_version").eq("user_id", actor.userId);
  if (caregivers.error || !caregivers.data) return [];
  const circles = await db.from("circles").select("id, key_version, content").is("deleted_at", null);
  if (circles.error || !circles.data) return [];
  const byId = new Map(circles.data.map((row) => [row.id as string, row]));
  const statuses: CircleKeyStatus[] = [];
  for (const row of caregivers.data) {
    const circle = byId.get(row.circle_id as string);
    if (!circle) continue;
    if (row.role !== "owner") continue;
    const role = "owner" as const;
    statuses.push({
      circleId: row.circle_id as string,
      personName: personName(circle.content),
      role,
      circleKeyVersion: circle.key_version as number,
      wrapped: (row.circle_key_wrapped as string | null) ?? null,
      wrappedKeyVersion: row.key_version as number,
    });
  }
  return statuses;
}

/** First key for a circle that does not have one yet. Does not bump key_version. */
export async function storeOwnCircleKey(
  actor: Actor,
  circleId: string,
  circleKeyWrapped: string,
  keyVersion: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (actor.kind !== "caregiver" || actor.role !== "owner") return { ok: false, error: "Only the owner can create the first key." };
  if (!can(actor, "circle:rotate_key", { circleId })) return { ok: false, error: "You cannot save a key for this circle." };
  const db = clientFor(actor);
  const circle = await db.from("circles").select("key_version").eq("id", circleId).is("deleted_at", null).maybeSingle();
  if (circle.error || !circle.data) return { ok: false, error: "That circle was not found." };
  if ((circle.data.key_version as number) !== keyVersion) return { ok: false, error: "The key was already changed. Reload this page and try again." };
  const own = await db.from("circle_caregivers").select("circle_key_wrapped").eq("circle_id", circleId).eq("user_id", actor.userId).maybeSingle();
  if (own.error || !own.data) return { ok: false, error: generic };
  if (own.data.circle_key_wrapped) return { ok: false, error: "A key is already saved on your account." };
  const saved = await db
    .from("circle_caregivers")
    .update({ circle_key_wrapped: circleKeyWrapped, key_version: keyVersion })
    .eq("circle_id", circleId)
    .eq("user_id", actor.userId)
    .is("circle_key_wrapped", null)
    .select("user_id")
    .maybeSingle();
  if (saved.error || !saved.data) return { ok: false, error: generic };
  return { ok: true };
}

export type PreparedLink = { token: string; name: string; email: string | null };

/**
 * New circle key for the owner. The database moves key_version forward by one and
 * replaces every active helper token in that same transaction. Only token hashes are sent.
 */
export async function rotateCircleKey(
  actor: Actor,
  circleId: string,
  circleKeyWrapped: string,
  keyVersion: number,
): Promise<{ ok: true; keyVersion: number; links: PreparedLink[] } | { ok: false; error: string }> {
  if (!can(actor, "circle:rotate_key", { circleId })) return { ok: false, error: "Only the owner can change the key for this circle." };
  if (actor.kind !== "caregiver") return { ok: false, error: "Sign in with Google to change a key." };
  const db = clientFor(actor);
  const current = await db.from("circles").select("key_version").eq("id", circleId).is("deleted_at", null).maybeSingle();
  if (current.error || !current.data) return { ok: false, error: "That circle was not found." };
  let expected = 0;
  try {
    expected = nextCircleKeyVersion(current.data.key_version as number);
  } catch {
    return { ok: false, error: "The key was already changed. Reload this page and try again." };
  }
  if (keyVersion !== expected) return { ok: false, error: "The key was already changed. Reload this page and try again." };
  const members = await db.from("members").select("id, name, email").eq("circle_id", circleId).is("revoked_at", null);
  if (members.error || !members.data) return { ok: false, error: generic };
  const links = members.data.map((member) => {
    const token = newInviteToken();
    return {
      id: member.id as string,
      token,
      tokenHash: hashInvite(token),
      name: member.name as string,
      email: (member.email as string | null) ?? null,
    };
  });
  const { error } = await db.rpc("rotate_own_circle_key", {
    p_circle: circleId,
    p_wrapped: circleKeyWrapped,
    p_version: keyVersion,
    p_member_tokens: links.map((link) => ({ id: link.id, token_hash: link.tokenHash })),
  });
  if (error) {
    if (/key version/i.test(error.message ?? "")) return { ok: false, error: "The key was already changed. Reload this page and try again." };
    if (/only the owner/i.test(error.message ?? "")) return { ok: false, error: "Only the owner can change the key for this circle." };
    return { ok: false, error: generic };
  }
  return { ok: true, keyVersion, links: links.map(({ token, name, email }) => ({ token, name, email })) };
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
