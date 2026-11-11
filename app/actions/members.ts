"use server";

import "server-only";
import { getActor } from "@/lib/auth";
import { AddMemberSchema, ChangeRoleSchema, SetVisibilitySchema, MemberChangeSchema } from "@/lib/schema/circles";
import { addMember, changeRole, newMemberLink, renewMember, revokeMember, setVisibility, shareMemberLink } from "@/services/members";

export async function addMemberAction(input: unknown) {
  const parsed = AddMemberSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Check the form and try again." };
  const actor = await getActor(parsed.data.circleId);
  if (!actor) return { ok: false as const, error: "Sign in to continue." };
  const result = await addMember(actor, parsed.data);
  if (!result.ok) return result;
  return { ok: true as const, memberId: result.memberId, name: result.name, email: result.email, token: result.token };
}

export async function changeRoleAction(input: unknown) {
  const parsed = ChangeRoleSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Check the form and try again." };
  const actor = await getActor(parsed.data.circleId);
  if (!actor) return { ok: false as const, error: "Sign in to continue." };
  return changeRole(actor, parsed.data.circleId, parsed.data.memberId, parsed.data.role);
}

export async function setVisibilityAction(input: unknown) {
  const parsed = SetVisibilitySchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Check the form and try again." };
  const actor = await getActor(parsed.data.circleId);
  if (!actor) return { ok: false as const, error: "Sign in to continue." };
  return setVisibility(actor, parsed.data.circleId, parsed.data.memberId, parsed.data.visibility);
}

export async function revokeMemberAction(input: unknown) {
  const parsed = MemberChangeSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Check the form and try again." };
  const actor = await getActor(parsed.data.circleId);
  if (!actor) return { ok: false as const, error: "Sign in to continue." };
  return revokeMember(actor, parsed.data.circleId, parsed.data.memberId);
}

export async function renewMemberAction(input: unknown) {
  const parsed = MemberChangeSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Check the form and try again." };
  const actor = await getActor(parsed.data.circleId);
  if (!actor) return { ok: false as const, error: "Sign in to continue." };
  return renewMember(actor, parsed.data.circleId, parsed.data.memberId);
}

export async function newLinkAction(input: unknown) {
  const parsed = MemberChangeSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Check the form and try again." };
  const actor = await getActor(parsed.data.circleId);
  if (!actor) return { ok: false as const, error: "Sign in to continue." };
  const result = await newMemberLink(actor, parsed.data.circleId, parsed.data.memberId);
  if (!result.ok) return result;
  return { ok: true as const, memberId: result.memberId, name: result.name, email: result.email, token: result.token };
}

/** A new link and a new PIN for one person, to send with a visit update. Both are shown once. */
export async function shareLinkAction(input: unknown) {
  const parsed = MemberChangeSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Check the form and try again." };
  const actor = await getActor(parsed.data.circleId);
  if (!actor) return { ok: false as const, error: "Sign in to continue." };
  const result = await shareMemberLink(actor, parsed.data.circleId, parsed.data.memberId);
  if (!result.ok) return result;
  return { ok: true as const, memberId: result.memberId, name: result.name, email: result.email, token: result.token, pin: result.pin };
}
