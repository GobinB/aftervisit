"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getActor } from "@/lib/auth";
import { can } from "@/lib/permissions";
import type { Medication } from "@/lib/schema/medications";
import { ApplyVisitSchema } from "@/lib/schema/visit";
import { getCircle, listOwnCircleKeys } from "@/services/circles";
import { listMedications } from "@/services/medications";
import { listPeople } from "@/services/members";
import { applyVisit } from "@/services/visits";

export type VisitContext =
  | {
      ok: true;
      personName: string;
      medications: Medication[];
      people: { value: string; label: string }[];
      /** The people who can be sent a new link after the visit, and the key version their links are built with. */
      helpers: { id: string; name: string; roleLabel: string; email: string | null }[];
      keyVersion: number | null;
    }
  | { ok: false; error: string };

/** The circle's person, current list and people, so the visit can be lined up before anything is saved. */
export async function visitContextAction(circleId: unknown): Promise<VisitContext> {
  const parsed = z.string().uuid().safeParse(circleId);
  if (!parsed.success) return { ok: false, error: "That circle was not found." };
  const actor = await getActor(parsed.data);
  if (!actor || actor.kind !== "caregiver") return { ok: false, error: "Sign in to update the circle." };
  if (!can(actor, "medications:edit", { circleId: parsed.data }) || !can(actor, "tasks:manage", { circleId: parsed.data })) {
    return { ok: false, error: "Only the caregiver can update the circle from a visit." };
  }
  const content = await getCircle(actor, parsed.data);
  if (!content) return { ok: false, error: "That circle was not found." };
  const medications = (await listMedications(actor, parsed.data)) ?? [];
  const listed = await listPeople(actor, parsed.data);
  const active = (listed.ok ? listed.people : []).filter((person) => person.kind === "member" && !person.revokedAt);
  const people = active.map((person) => ({ value: person.id, label: `${person.name} (${person.roleLabel})` }));
  const helpers = active.map((person) => ({ id: person.id, name: person.name, roleLabel: person.roleLabel, email: person.email ?? null }));
  const keyVersion = (await listOwnCircleKeys(actor)).find((item) => item.circleId === parsed.data)?.circleKeyVersion ?? null;
  return { ok: true, personName: content.person_name, medications, people, helpers, keyVersion };
}

export async function applyVisitAction(input: unknown) {
  const parsed = ApplyVisitSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Check the changes and try again." };
  const actor = await getActor(parsed.data.circleId);
  if (!actor) return { ok: false as const, error: "Sign in to update the circle." };
  const result = await applyVisit(actor, parsed.data);
  if (result.ok) {
    for (const path of ["", "/medications", "/todos", "/calendar"]) revalidatePath(`/circles/${parsed.data.circleId}${path}`);
  }
  return result;
}
