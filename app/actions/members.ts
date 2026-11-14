"use server";

import "server-only";
import { z } from "zod";
import { getActor } from "@/lib/auth";
import { AddMemberSchema, ChangeRoleSchema, SetVisibilitySchema, MemberChangeSchema } from "@/lib/schema/circles";
import { addMember, changeRole, getPendingUpdates, markTold, memberLink, newMemberLink, revokeMember, setVisibility } from "@/services/members";

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

export async function newLinkAction(input: unknown) {
  const parsed = MemberChangeSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Check the form and try again." };
  const actor = await getActor(parsed.data.circleId);
  if (!actor) return { ok: false as const, error: "Sign in to continue." };
  const result = await newMemberLink(actor, parsed.data.circleId, parsed.data.memberId);
  if (!result.ok) return result;
  return { ok: true as const, memberId: result.memberId, name: result.name, email: result.email, token: result.token, hasPin: result.hasPin };
}

/** A person's current link, to share again. It is the same link they already have. */
export async function memberLinkAction(input: unknown) {
  const parsed = MemberChangeSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Check the form and try again." };
  const actor = await getActor(parsed.data.circleId);
  if (!actor) return { ok: false as const, error: "Sign in to continue." };
  return memberLink(actor, parsed.data.circleId, parsed.data.memberId);
}

const MarkToldSchema = z.object({ circleId: z.string().uuid(), memberIds: z.array(z.string().uuid()).max(200) }).strict();

/** The caregiver sent these people their link about the latest changes, or chose to skip it this time. */
export async function markToldAction(input: unknown) {
  const parsed = MarkToldSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Check the form and try again." };
  const actor = await getActor(parsed.data.circleId);
  if (!actor) return { ok: false as const, error: "Sign in to continue." };
  return markTold(actor, parsed.data.circleId, parsed.data.memberIds);
}

/** Who has not heard about the latest changes. Used by screens outside the circle's own pages, such as the end of a visit. */
export async function pendingUpdatesAction(circleId: unknown) {
  const parsed = z.string().uuid().safeParse(circleId);
  if (!parsed.success) return [];
  const actor = await getActor(parsed.data);
  if (!actor) return [];
  return getPendingUpdates(actor, parsed.data);
}
