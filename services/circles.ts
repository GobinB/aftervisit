import "server-only";
import { createHash } from "node:crypto";
import type { Actor } from "@/lib/auth";
import { hashInvite, newInviteToken } from "@/lib/invites";
import { can } from "@/lib/permissions";
import { CONSENT_TEXT, CONSENT_TYPES, CONSENT_VERSION, CircleContentSchema, MEMBER_TTL_DAYS, nextCircleKeyVersion, type CircleContent, type CircleKeyStatus, type CreateCircleInput } from "@/lib/schema/circles";
import { clientFor } from "@/store/db";

const generic = "That could not be saved. Try again.";

function textHash(type: (typeof CONSENT_TYPES)[number]): string {
  return createHash("sha256").update(`${CONSENT_VERSION}\n${CONSENT_TEXT[type]}`).digest("hex");
}

export async function createCircle(actor: Actor, input: CreateCircleInput): Promise<{ ok: true; circleId: string } | { ok: false; error: string }> {
  if (actor.kind !== "caregiver") return { ok: false, error: "Sign in with Google to create a circle." };
  const db = clientFor(actor);
  const { data, error } = await db.from("circles").insert({ owner_id: actor.userId, key_version: input.keyVersion, content: input.content }).select("id").single();
  if (error || !data) return { ok: false, error: generic };
  const circleId = data.id as string;
  const caregiver = await db.from("circle_caregivers").insert({
    circle_id: circleId,
    user_id: actor.userId,
    role: "owner",
    key_version: input.keyVersion,
    circle_key_wrapped: input.circleKeyWrapped,
  });
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
    const role = row.role === "owner" ? "owner" : "co_caregiver";
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
 * New circle key for this caregiver only. The database moves key_version forward by one.
 * Other caregivers keep their old wrapped key until a later change can share the new one.
 */
export async function rotateCircleKey(
  actor: Actor,
  circleId: string,
  circleKeyWrapped: string,
  keyVersion: number,
): Promise<{ ok: true; keyVersion: number; links: PreparedLink[]; linksReady: boolean } | { ok: false; error: string }> {
  if (!can(actor, "circle:rotate_key", { circleId })) return { ok: false, error: "You cannot change the key for this circle." };
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
  const { error } = await db.rpc("rotate_own_circle_key", { p_circle: circleId, p_wrapped: circleKeyWrapped, p_version: keyVersion });
  if (error) {
    if (/key version/i.test(error.message ?? "")) return { ok: false, error: "The key was already changed. Reload this page and try again." };
    return { ok: false, error: generic };
  }
  const members = await db.from("members").select("id, name, email").eq("circle_id", circleId).is("revoked_at", null);
  if (members.error || !members.data) return { ok: true, keyVersion, links: [], linksReady: false };
  const expiresAt = new Date(Date.now() + MEMBER_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const links: PreparedLink[] = [];
  for (const member of members.data) {
    const token = newInviteToken();
    const updated = await db
      .from("members")
      .update({ token_hash: hashInvite(token), pin_failures: 0, locked_until: null, lock_count: 0, expires_at: expiresAt })
      .eq("id", member.id as string)
      .eq("circle_id", circleId)
      .select("id")
      .maybeSingle();
    if (!updated.data) return { ok: true, keyVersion, links, linksReady: false };
    links.push({ token, name: member.name as string, email: (member.email as string | null) ?? null });
    await db.from("activity").insert({
      circle_id: circleId,
      actor: `caregiver:${actor.userId}`,
      action: "member_link",
      subject_type: "member",
      subject_id: member.id as string,
    });
  }
  return { ok: true, keyVersion, links, linksReady: true };
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
