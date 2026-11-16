import "server-only";
import { circleTimeZone } from "@/services/circles";
import { todayIn } from "@/lib/time-zone";
import type { Actor } from "@/lib/auth";
import { can } from "@/lib/permissions";
import type { ApplyVisitInput } from "@/lib/schema/visit";
import { VisitContentSchema, sortVisits, viewOfVisit, type VisitContent, type VisitUpdateInput, type VisitView } from "@/lib/schema/visits";
import { clientFor } from "@/store/db";
import { saveEvent } from "@/services/events";

export type ApplyResult =
  | {
      ok: true;
      added: number;
      changed: number;
      stopped: number;
      todos: number;
      events: number;
      failed: number;
      /** The saved visit, for keeping the photos with it. Null when the notes could not be saved. */
      visitId: string | null;
      /** How many lines were kept with the visit: watch for, good to know and questions. */
      notes: number;
    }
  | { ok: false; error: string };

function assignee(value: ApplyVisitInput["todos"][number]["assignee"]) {
  if (value === "caregiver") return { assigned_to_caregiver: true, assignee_member_id: null };
  if (value === "none") return { assigned_to_caregiver: false, assignee_member_id: null };
  return { assigned_to_caregiver: false, assignee_member_id: value };
}

/**
 * Writes a confirmed visit into the circle: adds, changes and stops medications, adds reminders,
 * puts follow-up appointments on the calendar with who is going, and keeps the visit's notes (the
 * short summary, what to watch for, good to know, questions for the next visit).
 * Every row is marked as coming from a visit, so the medication history says so. Only the caregiver can.
 * Each write is limited to this circle; a write that fails is counted, and the rest still go through.
 */
export async function applyVisit(actor: Actor, input: ApplyVisitInput): Promise<ApplyResult> {
  const circleId = input.circleId;
  if (
    actor.kind !== "caregiver" ||
    !can(actor, "medications:edit", { circleId }) ||
    !can(actor, "tasks:manage", { circleId }) ||
    (input.events.length > 0 && !can(actor, "calendar:edit", { circleId }))
  ) {
    return { ok: false, error: "Only the caregiver can update the circle from a visit." };
  }
  const db = clientFor(actor);
  // Today where the person lives, for medicines stopped or started by this visit.
  const today = todayIn(await circleTimeZone(actor, circleId));
  const counts = { added: 0, changed: 0, stopped: 0, todos: 0, events: 0, failed: 0 };

  // The visit itself first, so the notes are kept even if a later write fails.
  let visitId: string | null = null;
  let notes = 0;
  if (input.notes) {
    const content: VisitContent = { ...input.notes, clinic: input.clinic || undefined };
    const { data, error } = await db
      .from("visits")
      .insert({ circle_id: circleId, visit_date: input.visitDate ?? null, content })
      .select("id")
      .single();
    if (error || !data) counts.failed++;
    else {
      visitId = data.id as string;
      notes = content.watchFor.length + content.goodToKnow.length + content.questions.length;
    }
  }

  for (const med of input.meds) {
    if (med.action === "add") {
      const { error } = await db.from("medications").insert({
        circle_id: circleId,
        name: med.name,
        dose: med.dose,
        schedule: med.schedule,
        instructions: med.detail || null,
        reason: med.reason ?? null,
        start_date: input.visitDate ?? null,
        source: "handoff",
      });
      if (error) counts.failed++;
      else counts.added++;
    } else if (med.action === "update") {
      const { data, error } = await db
        .from("medications")
        .update({ ...(med.dose ? { dose: med.dose } : {}), instructions: med.detail || null, source: "handoff" })
        .eq("circle_id", circleId)
        .eq("id", med.medId)
        .eq("status", "active")
        .select("id")
        .maybeSingle();
      if (error || !data) counts.failed++;
      else counts.changed++;
    } else {
      const { data, error } = await db
        .from("medications")
        .update({ status: "stopped", stop_date: input.visitDate ?? today, source: "handoff" })
        .eq("circle_id", circleId)
        .eq("id", med.medId)
        .eq("status", "active")
        .select("id")
        .maybeSingle();
      if (error || !data) counts.failed++;
      else counts.stopped++;
    }
  }

  const from = input.clinic ? `From the visit at ${input.clinic}` : "From a visit summary";
  for (const todo of input.todos) {
    const { error } = await db.from("todos").insert({
      circle_id: circleId,
      title: todo.title,
      due_date: todo.dueDate ?? null,
      note: todo.note ? `${todo.note}\n${from}` : from,
      source: "handoff",
      ...assignee(todo.assignee),
    });
    if (error) counts.failed++;
    else counts.todos++;
  }

  for (const event of input.events) {
    const saved = await saveEvent(actor, {
      circleId,
      title: event.title,
      date: event.date,
      startTime: event.startTime,
      location: event.location,
      notes: from,
      repeat: "none",
      going: event.going,
    });
    if (saved.ok) counts.events++;
    else counts.failed++;
  }

  await db.from("activity").insert({ circle_id: circleId, actor: `caregiver:${actor.userId}`, action: "visit_applied", subject_type: "circle", subject_id: circleId });
  return { ok: true, ...counts, visitId, notes };
}

type VisitRow = { id: string; visit_date: string | null; created_at: string; content: unknown };

const VISIT_COLUMNS = "id, visit_date, created_at, content";

function toVisit(row: VisitRow, full: boolean): VisitView | null {
  const content = VisitContentSchema.safeParse(row.content ?? {});
  if (!content.success) return null;
  return viewOfVisit({ id: row.id, visitDate: row.visit_date, createdAt: row.created_at, content: content.data }, full);
}

/**
 * The circle's visits, newest first, cut down to what this viewer may see: everyone who can read
 * visit notes gets what to watch for and good to know; the summary and the questions only reach
 * the caregiver, family and care managers. Null when the viewer may not see visit notes at all.
 */
export async function listVisits(actor: Actor, circleId: string, limit = 50): Promise<VisitView[] | null> {
  if (!can(actor, "visits:read", { circleId })) return null;
  const full = can(actor, "visits:read:summary", { circleId });
  const { data, error } = await clientFor(actor).from("visits").select(VISIT_COLUMNS).eq("circle_id", circleId).order("created_at", { ascending: false }).limit(limit);
  if (error || !data) return [];
  return sortVisits((data as VisitRow[]).map((row) => toVisit(row, full)).filter((visit): visit is VisitView => visit !== null));
}

/** One visit, with the same cut as the list. The caregiver also gets the kept photos, if there are any. */
export async function getVisit(actor: Actor, circleId: string, id: string): Promise<VisitView | null> {
  if (!can(actor, "visits:read", { circleId })) return null;
  const full = can(actor, "visits:read:summary", { circleId });
  const db = clientFor(actor);
  const { data, error } = await db.from("visits").select(VISIT_COLUMNS).eq("circle_id", circleId).eq("id", id).maybeSingle();
  if (error || !data) return null;
  const visit = toVisit(data as VisitRow, full);
  if (!visit || actor.kind !== "caregiver") return visit;
  const { data: doc } = await db.from("visit_documents").select("id, paths").eq("circle_id", circleId).eq("visit_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle();
  return { ...visit, documentId: doc && ((doc.paths as string[] | null) ?? []).length ? (doc.id as string) : null };
}

/** The caregiver fixes a saved visit's notes. */
export async function updateVisit(actor: Actor, input: VisitUpdateInput): Promise<{ ok: true } | { ok: false; error: string }> {
  if (actor.kind !== "caregiver" || !can(actor, "visits:edit", { circleId: input.circleId })) return { ok: false, error: "Only the caregiver can change visit notes." };
  const { data, error } = await clientFor(actor)
    .from("visits")
    .update({ visit_date: input.visitDate ?? null, content: input.content })
    .eq("circle_id", input.circleId)
    .eq("id", input.id)
    .select("id")
    .maybeSingle();
  if (error || !data) return { ok: false, error: "The notes could not be saved. Try again." };
  return { ok: true };
}

/** Deletes a visit's notes. Medicines, reminders and appointments that came from the visit stay, and so do the kept photos. */
export async function deleteVisit(actor: Actor, circleId: string, id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (actor.kind !== "caregiver" || !can(actor, "visits:edit", { circleId })) return { ok: false, error: "Only the caregiver can delete visit notes." };
  const { data, error } = await clientFor(actor).from("visits").delete().eq("circle_id", circleId).eq("id", id).select("id").maybeSingle();
  if (error || !data) return { ok: false, error: "The notes could not be deleted. Try again." };
  return { ok: true };
}
