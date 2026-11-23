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
import { cleanPhone } from "@/lib/phone";
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
  | { status: "ready" }
  /** Saved to a Google account: it opens only for that account. Server-side only; never sent to the page. */
  | { status: "account"; circleId: string; userId: string };

/** The Google email of each signed-in person, for the caregiver's People page. Missing when it cannot be read. */
async function accountEmails(ids: string[]): Promise<Map<string, string>> {
  const emails = new Map<string, string>();
  await Promise.all(
    [...new Set(ids)].map(async (id) => {
      try {
        const { data, error } = await serviceClient().auth.admin.getUserById(id);
        if (!error && data.user?.email) emails.set(id, data.user.email);
      } catch {
        // Shown as "signed in" without the address.
      }
    }),
  );
  return emails;
}

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
/** Shown when a link saved to an account is opened without that sign-in. */
export const SAVED_TO_ACCOUNT = "This link is saved to a Google account. Sign in with that account to open it.";

function missingRelation(error: unknown): boolean {
  const code = (error as { code?: string }).code;
  const message = (error as { message?: string }).message ?? "";
  return code === "42P01" || code === "PGRST205" || /does not exist/i.test(message) || /could not find the table/i.test(message);
}

async function memberByToken(token: string) {
  if (!INVITE_RE.test(token)) return null;
  const { data, error } = await serviceClient()
    .from("members")
    .select("id, circle_id, role, pin_hash, locked_until, revoked_at, expires_at, token_hash, user_id")
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
    // Google sign-in takes the place of the PIN once the link is saved to an account.
    if (row.user_id) return { status: "account", circleId: row.circle_id as string, userId: row.user_id as string };
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
  if (row.user_id) return { ok: false, error: SAVED_TO_ACCOUNT };
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
  const phone = cleanPhone(input.phone);
  if (!phone.ok) return { ok: false, error: phone.error };
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
    phone: phone.phone,
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

/** The caregiver sets or clears one person's phone number. */
export async function setMemberPhone(actor: Actor, circleId: string, memberId: string, input: string) {
  if (!can(actor, "members:manage", { circleId })) return { ok: false as const, error: denied };
  const phone = cleanPhone(input);
  if (!phone.ok) return { ok: false as const, error: phone.error };
  const { data, error } = await clientFor(actor)
    .from("members")
    .update({ phone: phone.phone })
    .eq("id", memberId)
    .eq("circle_id", circleId)
    .select("id")
    .maybeSingle();
  if (error || !data) return { ok: false as const, error: generic };
  await log(actor, circleId, "member_phone", memberId);
  return { ok: true as const, phone: phone.phone };
}

/**
 * Your own phone number. The caregiver's is on their caregiver row; a person with a link sets
 * only the number on their own member row, through the server after the permission check.
 */
export async function setOwnPhone(actor: Actor, circleId: string, input: string) {
  if (!can(actor, "phone:edit:own", { circleId })) return { ok: false as const, error: "You cannot change this number." };
  const phone = cleanPhone(input);
  if (!phone.ok) return { ok: false as const, error: phone.error };
  const db = clientFor(actor);
  const saved =
    actor.kind === "helper"
      ? await db.from("members").update({ phone: phone.phone }).eq("id", actor.memberId).eq("circle_id", circleId).is("revoked_at", null).select("id").maybeSingle()
      : await db.from("circle_caregivers").update({ phone: phone.phone }).eq("circle_id", circleId).eq("user_id", actor.userId).select("circle_id").maybeSingle();
  if (saved.error || !saved.data) return { ok: false as const, error: generic };
  if (actor.kind === "helper") await log(actor, circleId, "member_phone", actor.memberId);
  return { ok: true as const, phone: phone.phone };
}

/** Your own phone number, to fill in the form. Null when there is none or it cannot be read. */
export async function getOwnPhone(actor: Actor, circleId: string): Promise<string | null> {
  if (!can(actor, "phone:edit:own", { circleId })) return null;
  const db = clientFor(actor);
  const { data, error } =
    actor.kind === "helper"
      ? await db.from("members").select("phone").eq("id", actor.memberId).eq("circle_id", circleId).maybeSingle()
      : await db.from("circle_caregivers").select("phone").eq("circle_id", circleId).eq("user_id", actor.userId).maybeSingle();
  if (error || !data) return null;
  return (data.phone as string | null) ?? null;
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
    .select("name, email, phone, pin_hash")
    .maybeSingle();
  if (error || !data) return { ok: false as const, error: generic };
  await log(actor, circleId, "member_link", memberId);
  return {
    ok: true as const,
    token,
    memberId,
    name: data.name as string,
    email: (data.email as string | null) ?? null,
    phone: (data.phone as string | null) ?? null,
    hasPin: Boolean(data.pin_hash),
  };
}

/**
 * A person's current link, to share again: the same link they already have. Only for the
 * caregiver, and only while the link still works.
 */
/**
 * A person's own link, to share again. A link made before links could be shared again was random; it
 * is replaced here, and the old one stops working. With `replace: false` (looking a link up before
 * anyone asked to share it) nothing is replaced, and such a link comes back as `oldLink`.
 */
export async function memberLink(actor: Actor, circleId: string, memberId: string, { replace = true }: { replace?: boolean } = {}) {
  if (!can(actor, "members:manage", { circleId })) return { ok: false as const, error: denied };
  const db = clientFor(actor);
  const { data, error } = await db
    .from("members")
    .select("name, email, phone, pin_hash, token_hash, link_version, revoked_at, expires_at")
    .eq("id", memberId)
    .eq("circle_id", circleId)
    .maybeSingle();
  if (error || !data) return { ok: false as const, error: generic };
  const first = (data.name as string).trim().split(/\s+/)[0];
  if (data.revoked_at) return { ok: false as const, error: `${first}'s link is turned off. Make a new link to let them back in.` };
  if (new Date(data.expires_at as string).getTime() <= Date.now()) return { ok: false as const, error: `${first}'s link has ended. Send them a fresh link.` };
  const token = memberToken(memberId, data.link_version as number);
  if (!token) return { ok: false as const, error: notSetUp };
  if (hashInvite(token) !== data.token_hash) {
    if (!replace) return { ok: false as const, oldLink: true as const, error: `${first} has an older link. Making a new one to text them stops the old one working.` };
    const adopted = await db.from("members").update({ token_hash: hashInvite(token) }).eq("id", memberId).eq("circle_id", circleId).select("id").maybeSingle();
    if (adopted.error || !adopted.data) return { ok: false as const, error: generic };
  }
  return {
    ok: true as const,
    token,
    memberId,
    name: data.name as string,
    email: (data.email as string | null) ?? null,
    phone: (data.phone as string | null) ?? null,
    hasPin: Boolean(data.pin_hash),
  };
}

export type SaveToAccountResult = { ok: true } | { ok: false; error: string };

/**
 * A person saves their own link to the Google account they are signed in with. It takes both: the
 * cookie their link set (so any PIN was typed), which is `actor`, and the verified sign-in, which is
 * `account`. A row is tied once: if it is already tied to someone, nothing changes. The database
 * (migration 0025) refuses the circle's own caregiver and a second person on one account.
 */
export async function saveLinkToAccount(actor: Actor, account: { userId: string }, circleId: string): Promise<SaveToAccountResult> {
  if (actor.kind !== "helper" || actor.circleId !== circleId) return { ok: false, error: "Open your link first, then save it to your account." };
  if (actor.userId) return { ok: true };
  if (!can(actor, "account:save:own", { circleId })) return { ok: false, error: "This link cannot be saved to an account." };
  const db = serviceClient();
  const { data, error } = await db
    .from("members")
    .update({ user_id: account.userId })
    .eq("id", actor.memberId)
    .eq("circle_id", circleId)
    .is("user_id", null)
    .is("revoked_at", null)
    .select("id")
    .maybeSingle();
  if (error) {
    const code = (error as { code?: string }).code;
    const message = (error as { message?: string }).message ?? "";
    if (code === "23505") return { ok: false, error: "This Google account is already saved to someone else in this circle. Ask the caregiver who runs it." };
    if (/runs a circle/i.test(message)) return { ok: false, error: "You run this circle, so it is already in your account." };
    return { ok: false, error: generic };
  }
  if (!data) {
    const { data: now } = await db.from("members").select("user_id").eq("id", actor.memberId).maybeSingle();
    if (now?.user_id === account.userId) return { ok: true };
    if (now?.user_id) return { ok: false, error: "This link is already saved to another Google account. Nothing was changed. Ask the caregiver who runs the circle if that is wrong." };
    return { ok: false, error: generic };
  }
  await log(actor, circleId, "member_account_saved", actor.memberId);
  return { ok: true };
}

/** The caregiver undoes a person's sign-in: their link opens on its own again. Their place in the circle stays. */
export async function undoMemberAccount(actor: Actor, circleId: string, memberId: string) {
  if (!can(actor, "members:manage", { circleId })) return { ok: false as const, error: denied };
  const { data, error } = await clientFor(actor)
    .from("members")
    .update({ user_id: null })
    .eq("id", memberId)
    .eq("circle_id", circleId)
    .not("user_id", "is", null)
    .select("id")
    .maybeSingle();
  if (error || !data) return { ok: false as const, error: "That person is not signed in." };
  await log(actor, circleId, "member_account_undo", memberId);
  return { ok: true as const };
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

/** Who runs a circle, for the line under the person's name at the top of every circle screen. */
export type CircleRunner = {
  /** Their Google profile name; null when it has none. */
  name: string | null;
  /** Their number for tap to call or text; null when none is saved, and always null for the caregiver themself. */
  phone: string | null;
  /** The person looking is the one who runs it. */
  you: boolean;
};

/**
 * The caregiver who runs this circle, when the person looking may see them ("members:read:caregivers",
 * as on the People list). Null for anyone the caregiver has hidden people from, and when it cannot be read:
 * the line is left out rather than the page failing, and the error is logged (its code and message, no names).
 */
export async function getCircleRunner(actor: Actor, circleId: string): Promise<CircleRunner | null> {
  if (!can(actor, "members:read:caregivers", { circleId })) return null;
  try {
    const { data, error } = await clientFor(actor)
      .from("circle_caregivers")
      .select("user_id, phone")
      .eq("circle_id", circleId)
      .eq("role", "owner")
      .maybeSingle();
    if (error) {
      console.error("circle runner read failed:", error.code, error.message);
      return null;
    }
    if (!data) return null;
    const userId = data.user_id as string;
    if (actor.kind === "caregiver" && actor.userId === userId) return { name: actor.name ?? null, phone: null, you: true };
    const name = (await caregiverNames([userId])).get(userId) ?? null;
    return { name, phone: (data.phone as string | null) ?? null, you: false };
  } catch (e) {
    console.error("circle runner read failed:", (e as Error).message);
    return null;
  }
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
    db.from("circle_caregivers").select("user_id, role, phone").eq("circle_id", circleId),
    names || canManage
      ? db
          .from("members")
          .select("id, name, role, email, phone, expires_at, revoked_at, last_seen_at, locked_until, visibility, user_id")
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
      phone: (row.phone as string | null) ?? null,
    });
  }
  if (memberRows) {
    if (memberRows.error) return { ok: false, error: generic };
    // Who has signed in, and with which Google email: only for the caregiver.
    const signedIn = canManage ? (memberRows.data ?? []).map((row) => row.user_id as string | null).filter((id): id is string => Boolean(id)) : [];
    const emails = signedIn.length ? await accountEmails(signedIn) : new Map<string, string>();
    for (const row of memberRows.data ?? []) {
      const role = row.role as HelperRole;
      const view: PersonView = {
        id: row.id as string,
        name: row.name as string,
        role,
        roleLabel: HELPER_ROLE_LABELS[role] ?? role,
        kind: "member",
        // Someone whose link was turned off is not someone to call; only the caregiver still sees it.
        phone: canManage || !row.revoked_at ? ((row.phone as string | null) ?? null) : null,
      };
      if (canManage) {
        view.email = (row.email as string | null) ?? null;
        view.expiresAt = row.expires_at as string;
        view.revokedAt = (row.revoked_at as string | null) ?? null;
        view.lastSeenAt = (row.last_seen_at as string | null) ?? null;
        view.locked = !!activeLock(row.locked_until as string | null);
        const visibility = VisibilitySchema.safeParse(row.visibility ?? {});
        view.hidden = visibility.success ? (visibility.data.hidden ?? []) : [];
        view.signedIn = Boolean(row.user_id);
        view.accountEmail = row.user_id ? (emails.get(row.user_id as string) ?? null) : null;
      }
      people.push(view);
    }
  }
  return { ok: true, people, canManage };
}
