import "server-only";
import type { Actor } from "@/lib/auth";
import { can } from "@/lib/permissions";
import type { Todo, TodoInput } from "@/lib/schema/todos";
import { clientFor } from "@/store/db";

const COLUMNS = "id, title, note, due_date, assignee_member_id, assigned_to_caregiver, status, done_at, created_at";
type Row = Record<string, unknown>;
type Result = { ok: true } | { ok: false; error: string };

const generic = "The reminder could not be saved. Try again.";
const denied = "You cannot change this reminder.";

function toTodo(row: Row): Todo {
  const memberId = (row.assignee_member_id as string | null) ?? null;
  return {
    id: row.id as string,
    title: row.title as string,
    note: (row.note as string | null) ?? null,
    dueDate: (row.due_date as string | null) ?? null,
    assignee: row.assigned_to_caregiver ? { kind: "caregiver" } : memberId ? { kind: "member", memberId } : null,
    status: row.status as Todo["status"],
    doneAt: (row.done_at as string | null) ?? null,
    createdAt: row.created_at as string,
  };
}

function who(actor: Actor): string {
  return actor.kind === "caregiver" ? `caregiver:${actor.userId}` : `member:${actor.memberId}`;
}

async function log(actor: Actor, circleId: string, action: string, todoId: string) {
  await clientFor(actor).from("activity").insert({ circle_id: circleId, actor: who(actor), action, subject_type: "todo", subject_id: todoId });
}

/**
 * The to-dos this viewer may see: all of them, or only their own (home aides and day programs).
 * Null when the viewer may not see to-dos at all.
 */
export async function listTodos(actor: Actor, circleId: string): Promise<Todo[] | null> {
  const all = can(actor, "tasks:read", { circleId });
  const ownOnly = !all && actor.kind === "helper" && can(actor, "tasks:read:own", { circleId, assigneeId: actor.memberId });
  if (!all && !ownOnly) return null;
  let query = clientFor(actor).from("todos").select(COLUMNS).eq("circle_id", circleId);
  if (ownOnly && actor.kind === "helper") query = query.eq("assignee_member_id", actor.memberId);
  const { data, error } = await query.order("created_at", { ascending: false }).limit(500);
  if (error || !data) return [];
  return data.map((row) => toTodo(row as Row));
}

export async function getTodo(actor: Actor, circleId: string, id: string): Promise<Todo | null> {
  if (!can(actor, "tasks:manage", { circleId })) return null;
  const { data, error } = await clientFor(actor).from("todos").select(COLUMNS).eq("circle_id", circleId).eq("id", id).maybeSingle();
  if (error || !data) return null;
  return toTodo(data as Row);
}

function assigneeColumns(assignee: TodoInput["assignee"]) {
  if (assignee === "caregiver") return { assigned_to_caregiver: true, assignee_member_id: null };
  if (assignee === "none") return { assigned_to_caregiver: false, assignee_member_id: null };
  return { assigned_to_caregiver: false, assignee_member_id: assignee };
}

/** Adds a to-do, or edits one when input.id is set. Only the caregiver. */
export async function saveTodo(actor: Actor, input: TodoInput): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (actor.kind !== "caregiver" || !can(actor, "tasks:manage", { circleId: input.circleId })) return { ok: false, error: "Only the caregiver can add or edit reminders." };
  const db = clientFor(actor);
  const row = { title: input.title, note: input.note ?? null, due_date: input.dueDate ?? null, ...assigneeColumns(input.assignee) };
  if (input.id) {
    const { data, error } = await db.from("todos").update(row).eq("circle_id", input.circleId).eq("id", input.id).select("id").maybeSingle();
    if (error || !data) return { ok: false, error: generic };
    return { ok: true, id: data.id as string };
  }
  const { data, error } = await db
    .from("todos")
    .insert({ ...row, circle_id: input.circleId })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: generic };
  await log(actor, input.circleId, "todo_added", data.id as string);
  return { ok: true, id: data.id as string };
}

/** "I'll do it": takes an open to-do that nobody has. If someone else took it first, nothing changes. */
export async function claimTodo(actor: Actor, circleId: string, id: string): Promise<Result> {
  if (!can(actor, "tasks:claim", { circleId })) return { ok: false, error: denied };
  const assign = actor.kind === "caregiver" ? { assigned_to_caregiver: true } : { assignee_member_id: actor.memberId };
  const { data, error } = await clientFor(actor)
    .from("todos")
    .update(assign)
    .eq("circle_id", circleId)
    .eq("id", id)
    .eq("status", "open")
    .is("assignee_member_id", null)
    .eq("assigned_to_caregiver", false)
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, error: generic };
  if (!data) return { ok: false, error: "Someone else has already taken this one." };
  await log(actor, circleId, "todo_claimed", id);
  return { ok: true };
}

/** Marks a to-do done, or open again. The caregiver can for any; a helper only for their own. */
export async function setTodoDone(actor: Actor, circleId: string, id: string, done: boolean): Promise<Result> {
  const any = can(actor, "tasks:update", { circleId });
  const own = actor.kind === "helper" && can(actor, "tasks:update:own", { circleId, assigneeId: actor.memberId });
  if (!any && !own) return { ok: false, error: denied };
  let query = clientFor(actor)
    .from("todos")
    .update(done ? { status: "done", done_at: new Date().toISOString(), done_by: who(actor) } : { status: "open", done_at: null, done_by: null })
    .eq("circle_id", circleId)
    .eq("id", id);
  if (!any && actor.kind === "helper") query = query.eq("assignee_member_id", actor.memberId);
  const { data, error } = await query.select("id").maybeSingle();
  if (error) return { ok: false, error: generic };
  if (!data) return { ok: false, error: denied };
  await log(actor, circleId, done ? "todo_done" : "todo_reopened", id);
  return { ok: true };
}

export async function deleteTodo(actor: Actor, circleId: string, id: string): Promise<Result> {
  if (actor.kind !== "caregiver" || !can(actor, "tasks:manage", { circleId })) return { ok: false, error: denied };
  const { error } = await clientFor(actor).from("todos").delete().eq("circle_id", circleId).eq("id", id);
  return error ? { ok: false, error: generic } : { ok: true };
}
