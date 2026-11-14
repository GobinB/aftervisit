import "server-only";
import { randomUUID } from "node:crypto";
import { activeLock, HARD_LOCK_AFTER, LOCK_MINUTES, MAX_PIN_ATTEMPTS, toPinCheck, type TryPinRow } from "@/lib/access";
import type { Actor } from "@/lib/auth";
import { COPY } from "@/lib/copy";
import { linkTag } from "@/lib/helper-cookie";
import { hashInvite, INVITE_RE } from "@/lib/invites";
import { linkExpiry, UPDATE_AREAS, type UpdateArea } from "@/lib/link-life";
import { memberToken } from "@/lib/member-token";
import { can } from "@/lib/permissions";
import { caregiverDisplayName } from "@/lib/caregiver-name";
import { CAREGIVER_ROLE_LABELS, HELPER_ROLE_LABELS, type AddMemberInput, type HelperRole, type PersonView, type Visibility, VisibilitySchema } from "@/lib/schema/circles";
import { PinSchema } from "@/lib/schema";
import { hashPin } from "@/lib/tokens";
import { whoNeedsUpdate, type PendingUpdate } from "@/lib/updates";
import { clientFor, serviceClient } from "@/store/db";

const denied = "You cannot change people on this circle.";
const generic = "That could not be saved. Try again.";

export type { PendingUpdate, PersonView };

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

const notSetUp = "Links are not set up on this site yet.";

function missingRelation(error: unknown): boolean {
  const code = (error as { code?: string }).code;
  const message = (error as { message?: string }).message ?? "";
  return code === "42P01" || code === "PGRST205" || /does not exist/i.test(message) || /could not find the table/i.test(message);
}

async function memberByToken(token: string) {
  if (!INVITE_RE.test(token)) return null;
  const { data, error } = await serviceClient()
    .from("members")
    .select("id, circle_id, role, pin_hash, locked_until, revoked_at, expires_at, token_hash")
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
): Promise<{ ok: true; memberId: string; circleId: string; role: HelperRole; link: string } | { ok: false; error: string }> {
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
  return { ok: true, memberId: row.id as string, circleId: row.circle_id as string, role: row.role as HelperRole, link: linkTag(row.token_hash as string) };
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
  const token = memberToken(id, 1);
  if (!token) return { ok: false, error: notSetUp };
  const now = new Date();
  const { error } = await clientFor(actor).from("members").insert({
    id,
    circle_id: input.circleId,
    name: input.name,
    role: input.role,
    email: input.email?.trim() ? input.email.trim() : null,
    token_hash: hashInvite(token),
    pin_hash: input.pin ? hashPin(id, input.pin) : null,
    visibility: input.visibility ?? {},
    link_version: 1,
    link_issued_at: now.toISOString(),
    expires_at: linkExpiry(now, now).toISOString(),
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

/**
 * A fresh link for one person: the old one stops working on every phone that opened it, and the
 * new one starts its own 30 and 90 days. Also lets a removed person back in. Their PIN, if they
 * have one, stays the same.
 */
export async function newMemberLink(actor: Actor, circleId: string, memberId: string) {
  if (!can(actor, "members:manage", { circleId })) return { ok: false as const, error: denied };
  const db = clientFor(actor);
  const current = await db.from("members").select("link_version").eq("id", memberId).eq("circle_id", circleId).maybeSingle();
  if (current.error || !current.data) return { ok: false as const, error: generic };
  const version = (current.data.link_version as number) + 1;
  const token = memberToken(memberId, version);
  if (!token) return { ok: false as const, error: notSetUp };
  const now = new Date();
  const { data, error } = await db
    .from("members")
    .update({
      token_hash: hashInvite(token),
      link_version: version,
      link_issued_at: now.toISOString(),
      expires_at: linkExpiry(now, now).toISOString(),
      last_told_at: now.toISOString(),
      revoked_at: null,
      pin_failures: 0,
      locked_until: null,
      lock_count: 0,
    })
    .eq("id", memberId)
    .eq("circle_id", circleId)
    .eq("link_version", version - 1)
    .select("name, email, pin_hash")
    .maybeSingle();
  if (error || !data) return { ok: false as const, error: generic };
  await log(actor, circleId, "member_link", memberId);
  return { ok: true as const, token, memberId, name: data.name as string, email: (data.email as string | null) ?? null, hasPin: Boolean(data.pin_hash) };
}

/**
 * A person's current link, to share again: the same link they already have. Only for the
 * caregiver, and only while the link still works.
 */
export async function memberLink(actor: Actor, circleId: string, memberId: string) {
  if (!can(actor, "members:manage", { circleId })) return { ok: false as const, error: denied };
  const db = clientFor(actor);
  const { data, error } = await db
    .from("members")
    .select("name, email, pin_hash, token_hash, link_version, revoked_at, expires_at")
    .eq("id", memberId)
    .eq("circle_id", circleId)
    .maybeSingle();
  if (error || !data) return { ok: false as const, error: generic };
  const first = (data.name as string).trim().split(/\s+/)[0];
  if (data.revoked_at) return { ok: false as const, error: `${first}'s link is turned off. Make a new link to let them back in.` };
  if (new Date(data.expires_at as string).getTime() <= Date.now()) return { ok: false as const, error: `${first}'s link has ended. Send them a fresh link.` };
  const token = memberToken(memberId, data.link_version as number);
  if (!token) return { ok: false as const, error: notSetUp };
  // A link made before links could be shared again was random; it is replaced the first time it is shared.
  if (hashInvite(token) !== data.token_hash) {
    const adopted = await db.from("members").update({ token_hash: hashInvite(token) }).eq("id", memberId).eq("circle_id", circleId).select("id").maybeSingle();
    if (adopted.error || !adopted.data) return { ok: false as const, error: generic };
  }
  return { ok: true as const, token, memberId, name: data.name as string, email: (data.email as string | null) ?? null, hasPin: Boolean(data.pin_hash) };
}

/** Records that the caregiver sent these people their link about the latest changes (or chose not to). */
export async function markTold(actor: Actor, circleId: string, memberIds: string[]) {
  if (!can(actor, "members:manage", { circleId })) return { ok: false as const, error: denied };
  if (!memberIds.length) return { ok: true as const };
  const { error } = await clientFor(actor).from("members").update({ last_told_at: new Date().toISOString() }).eq("circle_id", circleId).in("id", memberIds);
  if (error) return { ok: false as const, error: generic };
  return { ok: true as const };
}

/** The people who have not heard about the caregiver's latest changes, and what changed for each. Empty for anyone else. */
export async function getPendingUpdates(actor: Actor, circleId: string): Promise<PendingUpdate[]> {
  if (actor.kind !== "caregiver" || !can(actor, "members:manage", { circleId })) return [];
  const db = clientFor(actor);
  const [updates, members] = await Promise.all([
    db.from("circle_updates").select("area, changed_at").eq("circle_id", circleId),
    db
      .from("members")
      .select("id, name, role, visibility, last_seen_at, last_told_at, link_issued_at, expires_at")
      .eq("circle_id", circleId)
      .is("revoked_at", null)
      .order("created_at"),
  ]);
  if (updates.error || members.error || !updates.data?.length || !members.data?.length) return [];
  const now = Date.now();
  return whoNeedsUpdate(
    updates.data
      .filter((row) => (UPDATE_AREAS as readonly string[]).includes(row.area as string))
      .map((row) => ({ area: row.area as UpdateArea, changedAt: row.changed_at as string })),
    members.data
      .filter((row) => new Date(row.expires_at as string).getTime() > now)
      .map((row) => {
        const visibility = VisibilitySchema.safeParse(row.visibility ?? {});
        return {
          id: row.id as string,
          circleId,
          name: row.name as string,
          role: row.role as HelperRole,
          visibility: visibility.success ? visibility.data : {},
          lastSeenAt: (row.last_seen_at as string | null) ?? null,
          lastToldAt: (row.last_told_at as string | null) ?? null,
          linkIssuedAt: row.link_issued_at as string,
        };
      }),
  );
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
