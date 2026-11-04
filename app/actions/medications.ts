"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { getActor } from "@/lib/auth";
import { MedicationInputSchema, MedicationStatusSchema } from "@/lib/schema/medications";
import { saveMedication, setMedicationStatus } from "@/services/medications";

export async function saveMedicationAction(input: unknown) {
  const parsed = MedicationInputSchema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { ok: false as const, error: first?.message && first.code === "custom" ? first.message : "Check the form and try again." };
  }
  const actor = await getActor(parsed.data.circleId);
  if (!actor) return { ok: false as const, error: "Sign in to continue." };
  const result = await saveMedication(actor, parsed.data);
  if (result.ok) {
    revalidatePath(`/circles/${parsed.data.circleId}`);
    revalidatePath(`/circles/${parsed.data.circleId}/medications`);
  }
  return result;
}

export async function setMedicationStatusAction(input: unknown) {
  const parsed = MedicationStatusSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Check the form and try again." };
  const actor = await getActor(parsed.data.circleId);
  if (!actor) return { ok: false as const, error: "Sign in to continue." };
  const result = await setMedicationStatus(actor, parsed.data.circleId, parsed.data.id, parsed.data.status);
  if (result.ok) {
    revalidatePath(`/circles/${parsed.data.circleId}`);
    revalidatePath(`/circles/${parsed.data.circleId}/medications`);
  }
  return result;
}
