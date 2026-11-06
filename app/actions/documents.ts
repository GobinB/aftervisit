"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { getActor } from "@/lib/auth";
import { CreateDocumentSchema, DocumentChangeSchema } from "@/lib/schema/documents";
import { createDocument, deleteDocument } from "@/services/documents";

/** Starts a saved summary. The pages follow, one request each, to /api/documents/{id}/pages. */
export async function createDocumentAction(input: unknown) {
  const parsed = CreateDocumentSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "The summary could not be kept." };
  const actor = await getActor(parsed.data.circleId);
  if (!actor) return { ok: false as const, error: "Sign in to continue." };
  return createDocument(actor, parsed.data);
}

export async function deleteDocumentAction(input: unknown) {
  const parsed = DocumentChangeSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "That summary was not found." };
  const actor = await getActor(parsed.data.circleId);
  if (!actor) return { ok: false as const, error: "Sign in to continue." };
  const result = await deleteDocument(actor, parsed.data.circleId, parsed.data.id);
  if (result.ok) {
    revalidatePath(`/circles/${parsed.data.circleId}/visits`);
    revalidatePath(`/circles/${parsed.data.circleId}/summary`);
  }
  return result;
}
