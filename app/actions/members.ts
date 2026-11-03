"use server";

import "server-only";
import { headers } from "next/headers";
import { getActor } from "@/lib/auth";
import { AddMemberSchema, ChangeRoleSchema, SetVisibilitySchema, MemberChangeSchema } from "@/lib/schema/circles";
import { addMember, changeRole, newMemberLink, renewMember, revokeMember, setVisibility } from "@/services/members";

async function origin(): Promise<string> {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

function link(base: string, token: string) {
  return { link: `${base}/i/${token}` };
}

export async function addMemberAction(input: unknown) {
  const parsed = AddMemberSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Check the form and try again." };
  const base = await origin();
  const actor = await getActor(parsed.data.circleId);
  if (!actor) return { ok: false as const, error: "Sign in to continue." };
  const result = await addMember(actor, parsed.data);
  if (!result.ok) return result;
  return { ok: true as const, name: result.name, email: result.email, ...link(base, result.token) };
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
  const base = await origin();
  const actor = await getActor(parsed.data.circleId);
  if (!actor) return { ok: false as const, error: "Sign in to continue." };
  const result = await newMemberLink(actor, parsed.data.circleId, parsed.data.memberId);
  if (!result.ok) return result;
  return { ok: true as const, name: result.name, email: result.email, ...link(base, result.token) };
}
