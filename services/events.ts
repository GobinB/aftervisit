import "server-only";
import type { Actor } from "@/lib/auth";
import { can } from "@/lib/permissions";
import type { CareEvent, EventInput } from "@/lib/schema/events";
import { clientFor } from "@/store/db";

const COLUMNS = "id, title, event_date, start_time, end_time, location, notes, repeat, repeat_until, going_member_id, going_caregiver, needs_volunteer";
type Row = Record<string, unknown>;
type Result = { ok: true } | { ok: false; error: string };

const generic = "The event could not be saved. Try again.";

function toEvent(row: Row): CareEvent {
  const memberId = (row.going_member_id as string | null) ?? null;
  return {
    id: row.id as string,
    title: row.title as string,
    date: row.event_date as string,
    startTime: (row.start_time as string | null) ?? null,
    endTime: (row.end_time as string | null) ?? null,
    location: (row.location as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
    repeat: row.repeat as CareEvent["repeat"],
    repeatUntil: (row.repeat_until as string | null) ?? null,
    going: row.going_caregiver ? { kind: "caregiver" } : memberId ? { kind: "member", memberId } : null,
    needsVolunteer: Boolean(row.needs_volunteer),
  };
}

function who(actor: Actor): string {
  return actor.kind === "caregiver" ? `caregiver:${actor.userId}` : `member:${actor.memberId}`;
}

async function log(actor: Actor, circleId: string, action: string, eventId: string) {
  await clientFor(actor).from("activity").insert({ circle_id: circleId, actor: who(actor), action, subject_type: "event", subject_id: eventId });
}

/** Events that could fall in the range: one-off ones inside it, and repeating ones that started before its end. */
export async function listEvents(actor: Actor, circleId: string, from: string, to: string): Promise<CareEvent[] | null> {
  if (!can(actor, "calendar:read", { circleId })) return null;
  const { data, error } = await clientFor(actor)
    .from("events")
    .select(COLUMNS)
    .eq("circle_id", circleId)
    .lte("event_date", to)
    .or(`event_date.gte.${from},repeat.neq.none`)
    .limit(1000);
  if (error || !data) return [];
  return data.map((row) => toEvent(row as Row)).filter((event) => event.repeat === "none" || !event.repeatUntil || event.repeatUntil >= from);
}

export async function getEvent(actor: Actor, circleId: string, id: string): Promise<CareEvent | null> {
  if (!can(actor, "calendar:edit", { circleId })) return null;
  const { data, error } = await clientFor(actor).from("events").select(COLUMNS).eq("circle_id", circleId).eq("id", id).maybeSingle();
  if (error || !data) return null;
  return toEvent(data as Row);
}

function goingColumns(going: EventInput["going"]) {
  if (going === "caregiver") return { going_caregiver: true, going_member_id: null, needs_volunteer: false };
  if (going === "volunteer") return { going_caregiver: false, going_member_id: null, needs_volunteer: true };
  if (going === "none") return { going_caregiver: false, going_member_id: null, needs_volunteer: false };
  return { going_caregiver: false, going_member_id: going, needs_volunteer: false };
}

/** Adds or edits an event. The caregiver and family can (calendar:edit). */
export async function saveEvent(actor: Actor, input: EventInput): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (!can(actor, "calendar:edit", { circleId: input.circleId })) return { ok: false, error: "You cannot change the calendar." };
  const db = clientFor(actor);
  const row = {
    title: input.title,
    event_date: input.date,
    start_time: input.startTime ?? null,
    end_time: input.startTime ? (input.endTime ?? null) : null,
    location: input.location ?? null,
    notes: input.notes ?? null,
    repeat: input.repeat,
    repeat_until: input.repeat === "none" ? null : (input.repeatUntil ?? null),
    updated_by: who(actor),
    ...goingColumns(input.going),
  };
  if (input.id) {
    const { data, error } = await db.from("events").update(row).eq("circle_id", input.circleId).eq("id", input.id).select("id").maybeSingle();
    if (error || !data) return { ok: false, error: generic };
    return { ok: true, id: data.id as string };
  }
  const { data, error } = await db
    .from("events")
    .insert({ ...row, circle_id: input.circleId, created_by: who(actor) })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: generic };
  await log(actor, input.circleId, "event_added", data.id as string);
  return { ok: true, id: data.id as string };
}

/** "I'll go" on an event that asks for a volunteer. If someone else said it first, nothing changes. */
export async function goToEvent(actor: Actor, circleId: string, id: string): Promise<Result> {
  if (!can(actor, "calendar:edit", { circleId })) return { ok: false, error: "You cannot change the calendar." };
  const going = actor.kind === "caregiver" ? { going_caregiver: true } : { going_member_id: actor.memberId };
  const { data, error } = await clientFor(actor)
    .from("events")
    .update({ ...going, needs_volunteer: false, updated_by: who(actor) })
    .eq("circle_id", circleId)
    .eq("id", id)
    .eq("needs_volunteer", true)
    .is("going_member_id", null)
    .eq("going_caregiver", false)
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, error: generic };
  if (!data) return { ok: false, error: "Someone else is already going." };
  await log(actor, circleId, "event_claimed", id);
  return { ok: true };
}

/** Only the caregiver deletes events. */
export async function deleteEvent(actor: Actor, circleId: string, id: string): Promise<Result> {
  if (actor.kind !== "caregiver" || !can(actor, "calendar:edit", { circleId })) return { ok: false, error: "Only the caregiver can delete events." };
  const { error } = await clientFor(actor).from("events").delete().eq("circle_id", circleId).eq("id", id);
  return error ? { ok: false, error: generic } : { ok: true };
}
