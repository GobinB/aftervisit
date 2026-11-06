import "server-only";
import { randomUUID } from "node:crypto";
import { activeLock, HARD_LOCK_AFTER, LOCK_MINUTES, MAX_PIN_ATTEMPTS, toPinCheck, type TryPinRow } from "@/lib/access";
import type { Actor } from "@/lib/auth";
import { COPY } from "@/lib/copy";
import { hashInvite, INVITE_RE, newInviteToken } from "@/lib/invites";
import { can } from "@/lib/permissions";
import { caregiverDisplayName } from "@/lib/caregiver-name";
import { CAREGIVER_ROLE_LABELS, HELPER_ROLE_LABELS, MEMBER_TTL_DAYS, type AddMemberInput, type HelperRole, type PersonView, type Visibility, VisibilitySchema } from "@/lib/schema/circles";
import { PinSchema } from "@/lib/schema";
import { hashPin } from "@/lib/tokens";
import { clientFor, serviceClient } from "@/store/db";

const denied = "You cannot change people on this circle.";
const generic = "That could not be saved. Try again.";

export type { PersonView };

export type MemberLinkPreview =
  | { status: "absent" }
  | { status: "revoked" | "expired" }
  | { status: "locked"; message: string }
  | { status: "pin" }
  | { status: "ready" };

/** Google profile name for each caregiver. The role label is used when a name is missing. */
async function caregiverNames(ids: string[]): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  if (!ids.length) return names;
  await Promise.all(
    ids.map(async (id) => {
      try {
        const { data, error } = await serviceClient().auth.admin.getUserById(id);
        if (error || !data.user) return;
        const name = caregiverDisplayName(data.user.user_metadata);
        if (name) names.set(id, name);
      } catch {
        // No profile name. The list shows the role label instead.
      }
    }),
  );
  return names;
}

function expiresAt(): string {
  return new Date(Date.now() + MEMBER_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

function missingRelation(error: unknown): boolean {
  const code = (error as { code?: string }).code;
  const message = (error as { message?: string }).message ?? "";
  return code === "42P01" || code === "PGRST205" || /does not exist/i.test(message) || /could not find the table/i.test(message);
}

async function memberByToken(token: string) {
  if (!INVITE_RE.test(token)) return null;
  const { data, error } = await serviceClient()
    .from("members")
    .select("id, circle_id, role, pin_hash, locked_until, revoked_at, expires_at")
    .eq("token_hash", hashInvite(token))
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Used by /i/[token] before a session exists. Old handoff invites are not members and return absent. */
export async function previewMemberLink(token: string): Promise<MemberLinkPreview> {
  try {
    const row = await memberByToken(token);
    if (!row) return { status: "absent" };
    if (row.revoked_at) return { status: "revoked" };
    if (new Date(row.expires_at as string).getTime() <= Date.now()) return { status: "expired" };
    const lock = activeLock(row.locked_until as string | null);
    if (lock) return { status: "locked", message: COPY.pinLocked(lock.lockedUntil) };
    if (row.pin_hash) return { status: "pin" };
    return { status: "ready" };
  } catch (error) {
    if (missingRelation(error)) return { status: "absent" };
    throw error;
  }
}

/** Checks the member row and, when set, the per-link PIN. The action stores the cookie. */
export async function openMemberToken(
  token: string,
  pin?: string,
): Promise<{ ok: true; memberId: string; circleId: string; role: HelperRole } | { ok: false; error: string }> {
  const row = await memberByToken(token);
  if (!row) return { ok: false, error: COPY.notFound };
  if (row.revoked_at) return { ok: false, error: COPY.revoked };
  if (new Date(row.expires_at as string).getTime() <= Date.now()) return { ok: false, error: COPY.expired };
  const lock = activeLock(row.locked_until as string | null);
  if (lock) return { ok: false, error: COPY.pinLocked(lock.lockedUntil) };
  if (row.pin_hash) {
    if (!pin) return { ok: false, error: "Enter the 4-digit PIN." };
    const parsed = PinSchema.safeParse(pin);
    const { data, error } = await serviceClient()
      .rpc("try_pin", {
        p_token: "member",
        p_recipient: row.id,
        p_candidate: parsed.success ? hashPin(row.id as string, parsed.data) : null,
        p_max: MAX_PIN_ATTEMPTS,
        p_lock_minutes: LOCK_MINUTES,
        p_hard_after: HARD_LOCK_AFTER,
      })
      .single<TryPinRow>();
    if (error || !data) return { ok: false, error: "The PIN could not be checked. Try again." };
    const check = toPinCheck(data);
    if (!check.ok) {
      if (check.status === "wrong_pin") return { ok: false, error: COPY.pinWrong(check.attemptsLeft) };
      if (check.status === "locked") return { ok: false, error: COPY.pinLocked(check.lockedUntil) };
      return { ok: false, error: "Enter the 4-digit PIN." };
    }
  }
  return { ok: true, memberId: row.id as string, circleId: row.circle_id as string, role: row.role as HelperRole };
}

async function log(actor: Actor, circleId: string, action: string, memberId: string) {
  const who = actor.kind === "caregiver" ? `caregiver:${actor.userId}` : `member:${actor.memberId}`;
  await clientFor(actor).from("activity").insert({
    circle_id: circleId,
    actor: who,
    action,
    subject_type: "member",
    subject_id: memberId,
  });
}

export async function addMember(
  actor: Actor,
  input: AddMemberInput,
): Promise<{ ok: true; token: string; memberId: string; name: string; email: string | null } | { ok: false; error: string }> {
  if (!can(actor, "members:manage", { circleId: input.circleId })) return { ok: false, error: denied };
  const id = randomUUID();
  const token = newInviteToken();
  const { error } = await clientFor(actor).from("members").insert({
    id,
    circle_id: input.circleId,
    name: input.name,
    role: input.role,
    email: input.email?.trim() ? input.email.trim() : null,
    token_hash: hashInvite(token),
    pin_hash: input.pin ? hashPin(id, input.pin) : null,
    visibility: input.visibility ?? {},
    expires_at: expiresAt(),
  });
  if (error) return { ok: false, error: generic };
  await log(actor, input.circleId, "member_added", id);
  return { ok: true, token, memberId: id, name: input.name, email: input.email?.trim() ? input.email.trim() : null };
}

export async function changeRole(actor: Actor, circleId: string, memberId: string, role: HelperRole) {
  if (!can(actor, "members:manage", { circleId })) return { ok: false as const, error: denied };
  const { data, error } = await clientFor(actor)
    .from("members")
    .update({ role })
    .eq("id", memberId)
    .eq("circle_id", circleId)
    .select("id")
    .maybeSingle();
  if (error || !data) return { ok: false as const, error: generic };
  await log(actor, circleId, "member_role", memberId);
  return { ok: true as const };
}

export async function setVisibility(actor: Actor, circleId: string, memberId: string, visibility: Visibility) {
  if (!can(actor, "members:manage", { circleId })) return { ok: false as const, error: denied };
  const { data, error } = await clientFor(actor)
    .from("members")
    .update({ visibility })
    .eq("id", memberId)
    .eq("circle_id", circleId)
    .select("id")
    .maybeSingle();
  if (error || !data) return { ok: false as const, error: generic };
  await log(actor, circleId, "member_visibility", memberId);
  return { ok: true as const };
}

export async function revokeMember(actor: Actor, circleId: string, memberId: string) {
  if (!can(actor, "members:manage", { circleId })) return { ok: false as const, error: denied };
  const { data, error } = await clientFor(actor)
    .from("members")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", memberId)
    .eq("circle_id", circleId)
    .is("revoked_at", null)
    .select("id")
    .maybeSingle();
  if (error || !data) return { ok: false as const, error: "That person is not an active member of this circle." };
  await log(actor, circleId, "member_revoked", memberId);
  return { ok: true as const };
}

export async function renewMember(actor: Actor, circleId: string, memberId: string) {
  if (!can(actor, "members:manage", { circleId })) return { ok: false as const, error: denied };
  const { data, error } = await clientFor(actor)
    .from("members")
    .update({ expires_at: expiresAt() })
    .eq("id", memberId)
    .eq("circle_id", circleId)
    .is("revoked_at", null)
    .select("id")
    .maybeSingle();
  if (error || !data) return { ok: false as const, error: "Renew works on a link that is still active." };
  await log(actor, circleId, "member_renewed", memberId);
  return { ok: true as const };
}

export async function newMemberLink(actor: Actor, circleId: string, memberId: string) {
  if (!can(actor, "members:manage", { circleId })) return { ok: false as const, error: denied };
  const token = newInviteToken();
  const { data, error } = await clientFor(actor)
    .from("members")
    .update({
      token_hash: hashInvite(token),
      pin_failures: 0,
      locked_until: null,
      lock_count: 0,
      expires_at: expiresAt(),
    })
    .eq("id", memberId)
    .eq("circle_id", circleId)
    .select("name, email")
    .maybeSingle();
  if (error || !data) return { ok: false as const, error: generic };
  await log(actor, circleId, "member_link", memberId);
  return { ok: true as const, token, memberId, name: data.name as string, email: (data.email as string | null) ?? null };
}

export async function listPeople(actor: Actor, circleId: string): Promise<{ ok: true; people: PersonView[]; canManage: boolean } | { ok: false; error: string }> {
  const canManage = can(actor, "members:manage", { circleId });
  const names = can(actor, "members:read", { circleId });
  const caregivers = can(actor, "members:read:caregivers", { circleId });
  if (!canManage && !names && !caregivers) return { ok: false, error: "You cannot view people on this circle." };
  const db = clientFor(actor);
  const people: PersonView[] = [];
  // The caregivers and the helpers are read at once rather than one after the other.
  const [caregiverRows, memberRows] = await Promise.all([
    db.from("circle_caregivers").select("user_id, role").eq("circle_id", circleId),
    names || canManage
      ? db
          .from("members")
          .select("id, name, role, email, expires_at, revoked_at, last_seen_at, locked_until, visibility")
          .eq("circle_id", circleId)
          .order("created_at")
      : Promise.resolve(null),
  ]);
  if (caregiverRows.error) return { ok: false, error: generic };
  // A caregiver looking at their own circle already has their name; only others need a lookup.
  const own = actor.kind === "caregiver" && actor.name ? new Map([[actor.userId, actor.name]]) : new Map<string, string>();
  const lookup = (caregiverRows.data ?? []).map((row) => row.user_id as string).filter((id) => !own.has(id));
  const displayNames = new Map([...own, ...(await caregiverNames(lookup))]);
  for (const row of caregiverRows.data ?? []) {
    if (row.role !== "owner") continue;
    const role = "owner" as const;
    const roleLabel = CAREGIVER_ROLE_LABELS[role];
    people.push({
      id: row.user_id as string,
      name: displayNames.get(row.user_id as string) || roleLabel,
      role,
      roleLabel,
      kind: "caregiver",
    });
  }
  if (memberRows) {
    if (memberRows.error) return { ok: false, error: generic };
    for (const row of memberRows.data ?? []) {
      const role = row.role as HelperRole;
      const view: PersonView = {
        id: row.id as string,
        name: row.name as string,
        role,
        roleLabel: HELPER_ROLE_LABELS[role] ?? role,
        kind: "member",
      };
      if (canManage) {
        view.email = (row.email as string | null) ?? null;
        view.expiresAt = row.expires_at as string;
        view.revokedAt = (row.revoked_at as string | null) ?? null;
        view.lastSeenAt = (row.last_seen_at as string | null) ?? null;
        view.locked = !!activeLock(row.locked_until as string | null);
        const visibility = VisibilitySchema.safeParse(row.visibility ?? {});
        view.hidden = visibility.success ? (visibility.data.hidden ?? []) : [];
      }
      people.push(view);
    }
  }
  return { ok: true, people, canManage };
}
