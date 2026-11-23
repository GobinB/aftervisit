import "server-only";
import { createHash } from "node:crypto";
import { cache } from "react";
import type { Actor } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { CONSENT_TEXT, CONSENT_TYPES, CONSENT_VERSION, CircleContentSchema, HELPER_ROLE_LABELS, type CircleContent, type CreateCircleInput, type HelperRole } from "@/lib/schema/circles";
import { clientFor, createCircleRecord, serviceClient } from "@/store/db";

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

export type CircleListItem = {
  id: string;
  personName: string;
  /** "run": the signed-in person is its caregiver. "help": they saved their link in it to their account. */
  kind: "run" | "help";
  /** Their role in a circle they help in, as the People page names it. */
  roleLabel?: string;
};

function personNameOf(content: unknown): string {
  const parsed = CircleContentSchema.safeParse(content);
  return parsed.success ? parsed.data.person_name : "Circle";
}

/**
 * Every circle the signed-in person is in: the ones they run (their own session, row security
 * applies) and the ones they help in through their account (read on the server, by the user id
 * from their verified sign-in, and only live rows: not removed, not ended, circle not deleted).
 * Cached per request, so the circle frame and /circles share one read.
 */
export const listCircles = cache(async function listCircles(actor: Actor): Promise<CircleListItem[]> {
  if (actor.kind !== "caregiver") return [];
  const [own, helping] = await Promise.all([
    clientFor(actor).from("circles").select("id, content").is("deleted_at", null).order("created_at"),
    serviceClient()
      .from("members")
      .select("circle_id, role, created_at, circles!inner(content, deleted_at)")
      .eq("user_id", actor.userId)
      .is("revoked_at", null)
      .gt("expires_at", new Date().toISOString())
      .is("circles.deleted_at", null)
      .order("created_at"),
  ]);
  const run: CircleListItem[] = own.error || !own.data ? [] : own.data.map((row) => ({ id: row.id as string, personName: personNameOf(row.content), kind: "run" as const }));
  const ran = new Set(run.map((circle) => circle.id));
  const help: CircleListItem[] =
    helping.error || !helping.data
      ? []
      : helping.data
          .filter((row) => !ran.has(row.circle_id as string))
          .map((row) => {
            const circle = (Array.isArray(row.circles) ? row.circles[0] : row.circles) as { content: unknown } | null;
            const role = row.role as HelperRole;
            return { id: row.circle_id as string, personName: personNameOf(circle?.content), kind: "help" as const, roleLabel: HELPER_ROLE_LABELS[role] ?? role };
          });
  return [...run, ...help];
});

/**
 * The name of the person cared for, for the top of every circle screen. Everyone in the circle sees it,
 * whatever the caregiver hides from them: it is read on its own, not with the care summary, which
 * someone on "Calendar and reminders only" cannot open. Null when it cannot be read.
 */
export const getPersonName = cache(async function getPersonName(actor: Actor, circleId: string): Promise<string | null> {
  if (actor.kind === "helper" ? actor.circleId !== circleId : !actor.circleIds.includes(circleId)) return null;
  const { data, error } = await clientFor(actor).from("circles").select("content->>person_name").eq("id", circleId).is("deleted_at", null).maybeSingle();
  if (error) {
    // The frame falls back to "Your care circle"; logged so a broken read does not go unseen.
    console.error("person name read failed:", error.code, error.message);
    return null;
  }
  if (!data) return null;
  const name = (data as { person_name?: unknown }).person_name;
  return typeof name === "string" && name.trim() ? name : null;
});

/** Replaces the care summary. Only the caregiver may; row security checks it again. */
export async function updateCircleContent(actor: Actor, circleId: string, content: CircleContent): Promise<{ ok: true } | { ok: false; error: string }> {
  if (actor.kind !== "caregiver" || !actor.circleIds.includes(circleId) || !can(actor, "summary:edit", { circleId })) {
    return { ok: false, error: "Only the caregiver can change the care summary." };
  }
  const parsed = CircleContentSchema.safeParse(content);
  if (!parsed.success) return { ok: false, error: "Check the details and try again." };
  const db = clientFor(actor);
  // An editor that does not send the time zone (the care summary) keeps the one already stored.
  if (!parsed.data.time_zone) {
    const { data: current } = await db.from("circles").select("content").eq("id", circleId).maybeSingle();
    const zone = CircleContentSchema.safeParse(current?.content).data?.time_zone;
    if (zone) parsed.data.time_zone = zone;
  }
  const { data, error } = await db.from("circles").update({ content: parsed.data }).eq("id", circleId).is("deleted_at", null).select("id");
  if (error || !data?.length) return { ok: false, error: generic };
  return { ok: true };
}

/**
 * Records where the person lives. `onlyIfMissing` (from a page load) never replaces a zone already
 * set, so a caregiver who travels does not move every medicine time; the subscribe page can replace it.
 */
export async function setCircleTimeZone(
  actor: Actor,
  circleId: string,
  timeZone: string,
  onlyIfMissing: boolean,
): Promise<{ ok: true; timeZone: string } | { ok: false; error: string }> {
  if (actor.kind !== "caregiver" || !actor.circleIds.includes(circleId) || !can(actor, "summary:edit", { circleId })) {
    return { ok: false, error: "Only the caregiver can change this." };
  }
  const { data: row } = await clientFor(actor).from("circles").select("content").eq("id", circleId).is("deleted_at", null).maybeSingle();
  const current = CircleContentSchema.safeParse(row?.content);
  if (!current.success) return { ok: false, error: generic };
  if (onlyIfMissing && current.data.time_zone) return { ok: true, timeZone: current.data.time_zone };
  const result = await updateCircleContent(actor, circleId, { ...current.data, time_zone: timeZone });
  return result.ok ? { ok: true, timeZone } : result;
}

/**
 * Adds or removes one emergency contact, reading the circle's details first so nothing else on them
 * changes (the care summary editor writes them whole). A removal names the contact as well as its
 * place, so a page that is out of date cannot remove the wrong one.
 */
export async function changeEmergencyContacts(
  actor: Actor,
  circleId: string,
  change: { add: { name: string; relationship?: string; phone?: string } } | { remove: { index: number; name: string } },
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (actor.kind !== "caregiver" || !actor.circleIds.includes(circleId) || !can(actor, "summary:edit", { circleId })) {
    return { ok: false, error: "Only the caregiver can change the emergency contacts." };
  }
  const { data: row } = await clientFor(actor).from("circles").select("content").eq("id", circleId).is("deleted_at", null).maybeSingle();
  const current = CircleContentSchema.safeParse(row?.content);
  if (!current.success) return { ok: false, error: generic };
  const contacts = current.data.emergency_contacts;
  let next: typeof contacts;
  if ("add" in change) {
    if (contacts.length >= 20) return { ok: false, error: "There can be 20 emergency contacts at most." };
    next = [...contacts, change.add];
  } else {
    if (contacts[change.remove.index]?.name !== change.remove.name) return { ok: false, error: "That contact has already changed. Open the page again." };
    next = contacts.filter((_, i) => i !== change.remove.index);
  }
  return updateCircleContent(actor, circleId, { ...current.data, emergency_contacts: next });
}

/** The circle's time zone, or null (then "today" is the UTC date). A failed read never stops a save. */
export async function circleTimeZone(actor: Actor, circleId: string): Promise<string | null> {
  try {
    return (await getCircle(actor, circleId))?.time_zone ?? null;
  } catch {
    return null;
  }
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
