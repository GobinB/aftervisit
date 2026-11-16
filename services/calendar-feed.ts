import "server-only";
import { randomBytes } from "node:crypto";
import type { Actor } from "@/lib/auth";
import { caregiverDisplayName } from "@/lib/caregiver-name";
import { env } from "@/lib/env";
import { buildCalendar, type FeedMedicine, type FeedReminder } from "@/lib/ics";
import { CircleContentSchema } from "@/lib/schema/circles";
import type { CareEvent } from "@/lib/schema/events";
import { clientFor, serviceClient } from "@/store/db";

export const FEED_TOKEN_RE = /^[A-Za-z0-9_-]{32,64}$/;

export type FeedStatus = { url: string; createdAt: string; includeMedicines: boolean } | null;

const feedUrl = (token: string) => `${env.appUrl}/api/calendar/${token}.ics`;

function isCaregiver(actor: Actor, circleId: string): actor is Extract<Actor, { kind: "caregiver" }> {
  return actor.kind === "caregiver" && actor.circleIds.includes(circleId);
}

/** The circle's calendar link, for its caregiver, or null when it is off. */
export async function getFeed(actor: Actor, circleId: string): Promise<FeedStatus | undefined> {
  if (!isCaregiver(actor, circleId)) return undefined;
  const { data } = await clientFor(actor).from("calendar_feeds").select("token, created_at, include_medicines").eq("circle_id", circleId).maybeSingle();
  return data ? { url: feedUrl(data.token as string), createdAt: data.created_at as string, includeMedicines: data.include_medicines !== false } : null;
}

/**
 * Turns the link on, or replaces it with a new one; the old link stops working at once.
 * A new link keeps the old one's medicines setting; a first link carries medicines.
 */
export async function startFeed(
  actor: Actor,
  circleId: string,
): Promise<{ ok: true; url: string; includeMedicines: boolean } | { ok: false; error: string }> {
  if (!isCaregiver(actor, circleId)) return { ok: false, error: "Only the caregiver can share the calendar." };
  const token = randomBytes(32).toString("base64url");
  const db = clientFor(actor);
  const { data: old } = await db.from("calendar_feeds").select("include_medicines").eq("circle_id", circleId).maybeSingle();
  const includeMedicines = old?.include_medicines !== false;
  await db.from("calendar_feeds").delete().eq("circle_id", circleId);
  const { error } = await db.from("calendar_feeds").insert({ circle_id: circleId, token, created_by: actor.userId, include_medicines: includeMedicines });
  if (error) return { ok: false, error: "The calendar link could not be made. Try again." };
  return { ok: true, url: feedUrl(token), includeMedicines };
}

/** Puts medicines into the link, or leaves them out. Calendar apps follow at their next update. */
export async function setFeedMedicines(actor: Actor, circleId: string, include: boolean): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isCaregiver(actor, circleId)) return { ok: false, error: "Only the caregiver can change the calendar link." };
  const { data, error } = await clientFor(actor)
    .from("calendar_feeds")
    .update({ include_medicines: include })
    .eq("circle_id", circleId)
    .select("circle_id")
    .maybeSingle();
  if (error || !data) return { ok: false, error: "That could not be saved. Try again." };
  return { ok: true };
}

export async function stopFeed(actor: Actor, circleId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isCaregiver(actor, circleId)) return { ok: false, error: "Only the caregiver can turn off the calendar link." };
  const { error } = await clientFor(actor).from("calendar_feeds").delete().eq("circle_id", circleId);
  if (error) return { ok: false, error: "The calendar link could not be turned off. Try again." };
  return { ok: true };
}

/**
 * The calendar file for a link, or null when the link is unknown or its circle was deleted.
 * Appointments (with repeats), open reminders that have a due date and, unless the caregiver left
 * them out, medicine times as repeating entries on the days the Calendar page shows them.
 */
export async function feedFile(token: string): Promise<string | null> {
  if (!FEED_TOKEN_RE.test(token)) return null;
  const db = serviceClient();
  const { data: feed } = await db.from("calendar_feeds").select("circle_id, include_medicines").eq("token", token).maybeSingle();
  if (!feed) return null;
  const circleId = feed.circle_id as string;
  const yearAgo = new Date(Date.now() - 365 * 86_400_000).toISOString().slice(0, 10);
  const includeMedicines = feed.include_medicines !== false;
  const [circle, events, todos, members, meds] = await Promise.all([
    db.from("circles").select("content, owner_id").eq("id", circleId).is("deleted_at", null).maybeSingle(),
    db
      .from("events")
      .select("id, title, event_date, start_time, end_time, location, notes, repeat, repeat_until, going_member_id, going_caregiver, needs_volunteer")
      .eq("circle_id", circleId)
      .or(`event_date.gte.${yearAgo},repeat.neq.none`)
      .limit(2000),
    db.from("todos").select("id, title, due_date, assignee_member_id, assigned_to_caregiver").eq("circle_id", circleId).eq("status", "open").not("due_date", "is", null).limit(1000),
    db.from("members").select("id, name").eq("circle_id", circleId),
    includeMedicines
      ? db
          .from("medications")
          .select("id, name, dose, amount, form, schedule, every, weekdays, times, start_date, stop_date, status, updated_at")
          .eq("circle_id", circleId)
          .neq("schedule", "as_needed")
          .or(`status.eq.active,stop_date.gte.${yearAgo}`)
          .limit(500)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
  ]);
  if (!circle.data) return null;
  const content = CircleContentSchema.safeParse(circle.data.content);
  const personName = content.success ? content.data.person_name : "Care circle";
  const names = new Map((members.data ?? []).map((row) => [row.id as string, row.name as string]));
  let caregiver = "The caregiver";
  try {
    const { data } = await db.auth.admin.getUserById(circle.data.owner_id as string);
    caregiver = caregiverDisplayName(data.user?.user_metadata) ?? caregiver;
  } catch {}

  const careEvents: CareEvent[] = (events.data ?? []).map((row) => ({
    id: row.id as string,
    title: row.title as string,
    date: row.event_date as string,
    startTime: (row.start_time as string | null) ?? null,
    endTime: (row.end_time as string | null) ?? null,
    location: (row.location as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
    repeat: row.repeat as CareEvent["repeat"],
    repeatUntil: (row.repeat_until as string | null) ?? null,
    going: row.going_caregiver ? { kind: "caregiver" } : row.going_member_id ? { kind: "member", memberId: row.going_member_id as string } : null,
    needsVolunteer: Boolean(row.needs_volunteer),
  }));
  const reminders: FeedReminder[] = (todos.data ?? []).map((row) => ({
    id: row.id as string,
    title: row.title as string,
    dueDate: row.due_date as string,
    who: row.assigned_to_caregiver ? caregiver : row.assignee_member_id ? (names.get(row.assignee_member_id as string) ?? null) : null,
  }));
  const medicines: FeedMedicine[] = (meds.data ?? []).map((row) => ({
    id: row.id as string,
    name: row.name as string,
    dose: (row.dose as string | null) ?? null,
    amount: (row.amount as string | null) ?? null,
    form: (row.form as FeedMedicine["form"]) ?? null,
    schedule: row.schedule as FeedMedicine["schedule"],
    every: (row.every as number | null) ?? null,
    weekdays: ((row.weekdays as number[] | null) ?? []).map(Number),
    times: (row.times as string[] | null) ?? [],
    startDate: (row.start_date as string | null) ?? null,
    stopDate: (row.stop_date as string | null) ?? null,
    status: row.status as FeedMedicine["status"],
    updatedAt: row.updated_at as string,
  }));
  return buildCalendar({
    name: `${personName}'s care`,
    events: careEvents,
    reminders,
    medicines,
    goingName: (event) => (!event.going ? null : event.going.kind === "caregiver" ? caregiver : (names.get(event.going.memberId) ?? "Someone")),
    host: new URL(env.appUrl).host,
  });
}
