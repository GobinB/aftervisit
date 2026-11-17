"use server";

import "server-only";
import { z } from "zod";
import { getActor } from "@/lib/auth";
import { AddMemberSchema, ChangeRoleSchema, SetVisibilitySchema, MemberChangeSchema, SetMemberPhoneSchema, SetOwnPhoneSchema } from "@/lib/schema/circles";
import { addMember, changeRole, getPendingUpdates, markTold, memberLink, newMemberLink, revokeMember, setMemberPhone, setOwnPhone, setVisibility } from "@/services/members";
import { PHONE_HINT } from "@/lib/phone";

export async function addMemberAction(input: unknown) {
  const parsed = AddMemberSchema.safeParse(input);
  if (!parsed.success) {
    const phoneProblem = parsed.error.issues.some((issue) => issue.path[0] === "phone");
    return { ok: false as const, error: phoneProblem ? PHONE_HINT : "Check the form and try again." };
  }
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

/** The caregiver sets or clears one person's phone number. */
export async function setMemberPhoneAction(input: unknown) {
  const parsed = SetMemberPhoneSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: PHONE_HINT };
  const actor = await getActor(parsed.data.circleId);
  if (!actor) return { ok: false as const, error: "Sign in to continue." };
  return setMemberPhone(actor, parsed.data.circleId, parsed.data.memberId, parsed.data.phone);
}

/** Your own phone number: the caregiver's, or a person's from their own link. */
export async function setOwnPhoneAction(input: unknown) {
  const parsed = SetOwnPhoneSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: PHONE_HINT };
  const actor = await getActor(parsed.data.circleId);
  if (!actor) return { ok: false as const, error: "Open your link again to continue." };
  return setOwnPhone(actor, parsed.data.circleId, parsed.data.phone);
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

/** A person's current link, to share again: the same link they already have, unless theirs is an older one, which is replaced (see memberLink). */
export async function memberLinkAction(input: unknown) {
  const parsed = MemberChangeSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Check the form and try again." };
  const actor = await getActor(parsed.data.circleId);
  if (!actor) return { ok: false as const, error: "Sign in to continue." };
  return memberLink(actor, parsed.data.circleId, parsed.data.memberId);
}

/** A person's own link if it can be shared as it is. Never replaces an older link (see memberLink). */
export async function currentMemberLinkAction(input: unknown) {
  const parsed = MemberChangeSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Check the form and try again." };
  const actor = await getActor(parsed.data.circleId);
  if (!actor) return { ok: false as const, error: "Sign in to continue." };
  return memberLink(actor, parsed.data.circleId, parsed.data.memberId, { replace: false });
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
