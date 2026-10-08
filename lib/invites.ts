import "server-only";
import { createHash } from "node:crypto";
import { nanoid } from "nanoid";
import { db, getTombstone, isExpired, type GoneReason, type HandoffRow } from "./db";
import { env } from "./env";
import {
  SHARE_SECTIONS,
  type HandoffPayload,
  type HandoffView,
  type RecipientShare,
  type Role,
  type ShareSection,
  type TasksScope,
  type TaskStatusValue,
  type TaskStatusView,
} from "./schema";

/**
 * Personal invitations: one revocable link per person. The invitation token is shown once
 * and stored only as a hash. Everything a person can see is filtered on the server.
 */

export const INVITE_RE = /^[A-Za-z0-9_-]{24}$/;
export const newInviteToken = () => nanoid(24);
export const hashInvite = (invite: string) => createHash("sha256").update([env.salt, "invite", invite].join(":")).digest("hex");

export interface RecipientRow {
  id: string;
  handoff_token: string;
  name: string;
  role: Role;
  invite_hash: string;
  sections: ShareSection[];
  tasks_scope: TasksScope;
  created_at: string;
  revoked_at: string | null;
  first_opened_at: string | null;
  last_opened_at: string | null;
  acked_at: string | null;
}

export interface TaskStatusRow {
  handoff_token: string;
  task_id: string;
  assignee_id: string | null;
  status: TaskStatusValue;
  note: string | null;
  updated_at: string | null;
  updated_by_id: string | null;
  updated_by_name: string | null;
  updated_via: "personal_link" | "creator" | null;
  completed_at: string | null;
}

export interface EventRow {
  id: number;
  recipient_id: string | null;
  actor: string;
  via: "personal_link" | "creator" | "shared_link";
  kind: "invited" | "opened" | "acknowledged" | "task_status" | "revoked";
  detail: Record<string, unknown>;
  at: string;
}

const norm = (s?: string | null) => (s ?? "").trim().toLowerCase();

export function normalizeSections(sections?: ShareSection[]): ShareSection[] {
  // Only an omitted selection gets the defaults; an explicit empty list grants no sections.
  const set = new Set(sections === undefined ? SHARE_SECTIONS : sections);
  return SHARE_SECTIONS.filter((s) => set.has(s));
}

/** The recipient a task is assigned to, matched by name (assignees are typed on the Review screen). */
export function assigneeFor(assignee: string | undefined, recipients: Pick<RecipientRow, "id" | "name">[]): string | null {
  if (!assignee?.trim()) return null;
  return recipients.find((r) => norm(r.name) === norm(assignee))?.id ?? null;
}

export async function logEvent(e: Omit<EventRow, "id" | "at" | "detail"> & { handoff_token: string; detail?: Record<string, unknown> }) {
  await db()
    .from("handoff_events")
    .insert({ ...e, detail: e.detail ?? {} });
}

/** Creates one invitation per person and a status row per task. Returns the plaintext invitations once. */
export async function createInvitations(
  token: string,
  recipients: RecipientShare[],
  payload: HandoffPayload,
): Promise<{ id: string; name: string; role: Role; invite: string }[]> {
  const invites = recipients.map((r) => ({ r, invite: newInviteToken() }));
  const { data, error } = await db()
    .from("handoff_recipients")
    .insert(
      invites.map(({ r, invite }) => ({
        handoff_token: token,
        name: r.name,
        role: r.role,
        invite_hash: hashInvite(invite),
        sections: normalizeSections(r.sections),
        tasks_scope: r.tasksScope ?? "all",
      })),
    )
    .select("id, name, invite_hash");
  if (error) throw error;
  const rows = data as Pick<RecipientRow, "id" | "name" | "invite_hash">[];

  if (payload.tasks.length) {
    const { error: e2 } = await db()
      .from("handoff_task_status")
      .insert(payload.tasks.map((t) => ({ handoff_token: token, task_id: t.id, assignee_id: assigneeFor(t.assignee, rows), status: "not_started" })));
    if (e2) throw e2;
  }
  await db()
    .from("handoff_events")
    .insert(rows.map((r) => ({ handoff_token: token, recipient_id: r.id, actor: "creator", via: "creator", kind: "invited", detail: { name: r.name } })));

  return invites.map(({ r, invite }) => {
    const row = rows.find((x) => x.invite_hash === hashInvite(invite))!;
    return { id: row.id, name: r.name, role: r.role, invite };
  });
}

export type InviteLookup =
  | { status: "ok"; recipient: RecipientRow; row: HandoffRow }
  | { status: "revoked" | GoneReason | "not_found" };

export async function lookupInvite(invite: string): Promise<InviteLookup> {
  if (!INVITE_RE.test(invite)) return { status: "not_found" };
  const hash = hashInvite(invite);
  const { data, error } = await db().from("handoff_recipients").select("*").eq("invite_hash", hash).maybeSingle();
  if (error) throw error;
  if (!data) {
    const gone = await getTombstone(hash);
    return gone ? { status: gone } : { status: "not_found" };
  }
  const recipient = data as RecipientRow;
  if (recipient.revoked_at) return { status: "revoked" };
  const { data: h, error: e2 } = await db().from("handoffs").select("*").eq("token", recipient.handoff_token).maybeSingle();
  if (e2) throw e2;
  if (!h) return { status: "not_found" };
  const row = h as HandoffRow;
  if (isExpired(row)) return { status: "expired" };
  return { status: "ok", recipient, row };
}

export async function taskStatusRows(token: string): Promise<TaskStatusRow[]> {
  const { data, error } = await db().from("handoff_task_status").select("*").eq("handoff_token", token);
  if (error) throw error;
  return (data ?? []) as TaskStatusRow[];
}

export async function recipientsFor(token: string): Promise<RecipientRow[]> {
  const { data, error } = await db().from("handoff_recipients").select("*").eq("handoff_token", token).order("created_at");
  if (error) throw error;
  return (data ?? []) as RecipientRow[];
}

export async function eventsFor(token: string, limit = 40): Promise<EventRow[]> {
  const { data, error } = await db().from("handoff_events").select("*").eq("handoff_token", token).order("at", { ascending: false }).limit(limit);
  if (error) throw error;
  return (data ?? []) as EventRow[];
}

export function toStatusView(s: TaskStatusRow): TaskStatusView {
  return {
    status: s.status,
    note: s.note ?? undefined,
    updatedAt: s.updated_at ?? undefined,
    updatedByName: s.updated_by_name ?? undefined,
    updatedVia: s.updated_via ?? undefined,
    completedAt: s.completed_at ?? undefined,
    assigneeId: s.assignee_id,
  };
}

/** Which tasks this person sees: all of them, or only the ones assigned to them. */
export function visibleTaskIds(payload: HandoffPayload, recipient: RecipientRow, statuses: TaskStatusRow[]): Set<string> {
  if (!recipient.sections.includes("tasks")) return new Set();
  if (recipient.tasks_scope === "all") return new Set(payload.tasks.map((t) => t.id));
  return new Set(statuses.filter((s) => s.assignee_id === recipient.id).map((s) => s.task_id));
}

/**
 * The handoff as one person is allowed to see it. Sections they were not given are removed
 * on the server, so a personal link can never reveal more than the caregiver chose.
 */
export function inviteView(row: HandoffRow, recipient: RecipientRow, statuses: TaskStatusRow[]): HandoffView {
  const p = row.payload;
  const has = (s: ShareSection) => recipient.sections.includes(s);
  const taskIds = visibleTaskIds(p, recipient, statuses);
  const tasks = p.tasks.filter((t) => taskIds.has(t.id));
  const statusByTask = Object.fromEntries(statuses.filter((s) => taskIds.has(s.task_id)).map((s) => [s.task_id, toStatusView(s)]));
  const canUpdate = statuses.filter((s) => taskIds.has(s.task_id) && (s.assignee_id === recipient.id || s.assignee_id === null)).map((s) => s.task_id);

  const payload: HandoffPayload = {
    visit: {
      patientFirstName: p.visit.patientFirstName,
      date: p.visit.date,
      provider: p.visit.provider,
      specialty: p.visit.specialty,
      clinic: p.visit.clinic,
      reason: has("summary") ? p.visit.reason : undefined,
      summary: has("summary") ? p.visit.summary : "",
    },
    medications: has("medications") ? p.medications : [],
    tasks,
    watchFor: has("watchFor") ? p.watchFor : [],
    questions: has("questions") ? p.questions : [],
    otherNotes: has("otherNotes") ? p.otherNotes : [],
  };

  return {
    token: "", // never expose the handoff token through a personal link
    payload,
    createdByFirstName: row.created_by ?? undefined,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    recipients: [],
    ackCount: 0,
    hasOriginal: !!row.original_path && has("original"),
    invite: {
      recipientName: recipient.name,
      recipientRole: recipient.role,
      ackedAt: recipient.acked_at,
      tasksScope: recipient.tasks_scope,
      sections: recipient.sections,
      taskStatus: statusByTask,
      canUpdate,
    },
  };
}

/** Records that a person opened their link (the activity log notes it at most every 30 minutes). */
export async function recordOpen(recipient: RecipientRow) {
  const now = new Date().toISOString();
  const recent = recipient.last_opened_at && Date.now() - new Date(recipient.last_opened_at).getTime() < 30 * 60_000;
  await db()
    .from("handoff_recipients")
    .update({ last_opened_at: now, first_opened_at: recipient.first_opened_at ?? now })
    .eq("id", recipient.id);
  if (!recent) {
    await logEvent({ handoff_token: recipient.handoff_token, recipient_id: recipient.id, actor: recipient.name, via: "personal_link", kind: "opened" });
  }
}

/** Sets a task's status and logs who did it. */
export async function setTaskStatus(args: {
  token: string;
  taskId: string;
  status: TaskStatusValue;
  note?: string;
  by: { id: string | null; name: string; via: "personal_link" | "creator" };
}) {
  const now = new Date().toISOString();
  const { data, error } = await db()
    .from("handoff_task_status")
    .update({
      status: args.status,
      note: args.note?.trim() || null,
      updated_at: now,
      updated_by_id: args.by.id,
      updated_by_name: args.by.name,
      updated_via: args.by.via,
      completed_at: args.status === "completed" ? now : null,
    })
    .eq("handoff_token", args.token)
    .eq("task_id", args.taskId)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  await logEvent({
    handoff_token: args.token,
    recipient_id: args.by.id,
    actor: args.by.name,
    via: args.by.via,
    kind: "task_status",
    detail: { taskId: args.taskId, status: args.status, note: args.note?.trim() || undefined },
  });
  return toStatusView(data as TaskStatusRow);
}
