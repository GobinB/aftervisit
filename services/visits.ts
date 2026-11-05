import "server-only";
import type { Actor } from "@/lib/auth";
import { can } from "@/lib/permissions";
import type { ApplyVisitInput } from "@/lib/schema/visit";
import { clientFor } from "@/store/db";

export type ApplyResult = { ok: true; added: number; changed: number; stopped: number; todos: number; failed: number } | { ok: false; error: string };

function assignee(value: ApplyVisitInput["todos"][number]["assignee"]) {
  if (value === "caregiver") return { assigned_to_caregiver: true, assignee_member_id: null };
  if (value === "none") return { assigned_to_caregiver: false, assignee_member_id: null };
  return { assigned_to_caregiver: false, assignee_member_id: value };
}

/**
 * Writes a confirmed visit into the circle: adds, changes and stops medications, and adds to-dos.
 * Every row is marked as coming from a visit, so the medication history says so. Only the caregiver can.
 * Each write is limited to this circle; a write that fails is counted, and the rest still go through.
 */
export async function applyVisit(actor: Actor, input: ApplyVisitInput): Promise<ApplyResult> {
  const circleId = input.circleId;
  if (actor.kind !== "caregiver" || !can(actor, "medications:edit", { circleId }) || !can(actor, "tasks:manage", { circleId })) {
    return { ok: false, error: "Only the caregiver can update the circle from a visit." };
  }
  const db = clientFor(actor);
  const today = new Date().toISOString().slice(0, 10);
  const counts = { added: 0, changed: 0, stopped: 0, todos: 0, failed: 0 };

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

  await db.from("activity").insert({ circle_id: circleId, actor: `caregiver:${actor.userId}`, action: "visit_applied", subject_type: "circle", subject_id: circleId });
  return { ok: true, ...counts };
}
