import "server-only";
import type { Actor } from "@/lib/auth";
import { can } from "@/lib/permissions";
import type { Medication, MedicationChange, MedicationInput } from "@/lib/schema/medications";
import { clientFor } from "@/store/db";

const COLUMNS =
  "id, name, dose, amount, form, schedule, every, weekdays, times, start_date, stop_date, status, reason, instructions, prescriber, refills_left, last_refill, source, updated_at";

type Row = Record<string, unknown>;

function toMedication(row: Row): Medication {
  return {
    id: row.id as string,
    name: row.name as string,
    dose: (row.dose as string | null) ?? null,
    amount: (row.amount as string | null) ?? null,
    form: (row.form as Medication["form"]) ?? null,
    schedule: row.schedule as Medication["schedule"],
    every: (row.every as number | null) ?? null,
    weekdays: ((row.weekdays as number[] | null) ?? []).map(Number),
    times: (row.times as string[] | null) ?? [],
    startDate: (row.start_date as string | null) ?? null,
    stopDate: (row.stop_date as string | null) ?? null,
    status: row.status as Medication["status"],
    reason: (row.reason as string | null) ?? null,
    instructions: (row.instructions as string | null) ?? null,
    prescriber: (row.prescriber as string | null) ?? null,
    refillsLeft: (row.refills_left as number | null) ?? null,
    lastRefill: (row.last_refill as string | null) ?? null,
    source: (row.source as Medication["source"]) ?? "caregiver",
    updatedAt: row.updated_at as string,
  };
}

/** Active first, then by name. Null when the viewer may not see medications. */
export async function listMedications(actor: Actor, circleId: string): Promise<Medication[] | null> {
  if (!can(actor, "medications:read", { circleId })) return null;
  const { data, error } = await clientFor(actor).from("medications").select(COLUMNS).eq("circle_id", circleId);
  if (error || !data) return [];
  return data
    .map((row) => toMedication(row as Row))
    .sort((a, b) => (a.status === b.status ? a.name.localeCompare(b.name) : a.status === "active" ? -1 : 1));
}

export async function getMedication(actor: Actor, circleId: string, id: string): Promise<Medication | null> {
  if (!can(actor, "medications:edit", { circleId })) return null;
  const { data, error } = await clientFor(actor).from("medications").select(COLUMNS).eq("circle_id", circleId).eq("id", id).maybeSingle();
  if (error || !data) return null;
  return toMedication(data as Row);
}

/** Newest changes first. Only the caregiver sees the history. */
export async function listMedicationChanges(actor: Actor, circleId: string, limit = 12): Promise<MedicationChange[]> {
  if (actor.kind !== "caregiver" || !can(actor, "medications:edit", { circleId })) return [];
  const { data, error } = await clientFor(actor)
    .from("medication_changes")
    .select("id, medication_id, at, change, summary")
    .eq("circle_id", circleId)
    .order("at", { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return data.map((row) => ({
    id: row.id as string,
    medicationId: row.medication_id as string,
    at: row.at as string,
    change: row.change as MedicationChange["change"],
    summary: row.summary as string,
  }));
}

function toRow(input: MedicationInput) {
  const repeats = input.schedule === "every_x_days" || input.schedule === "every_x_weeks" || input.schedule === "every_x_months";
  return {
    name: input.name,
    dose: input.dose ?? null,
    amount: input.amount ?? null,
    form: input.form ?? null,
    schedule: input.schedule,
    every: repeats ? (input.every ?? 1) : null,
    weekdays: input.schedule === "weekdays" ? [...new Set(input.weekdays)].sort() : null,
    times: input.schedule === "as_needed" ? [] : [...new Set(input.times)].sort(),
    start_date: input.startDate ?? null,
    reason: input.reason ?? null,
    instructions: input.instructions ?? null,
    prescriber: input.prescriber ?? null,
    refills_left: input.refillsLeft ?? null,
    last_refill: input.lastRefill ?? null,
  };
}

const generic = "The medication could not be saved. Try again.";

/** Adds a medication, or updates one when input.id is set. Only the caregiver can. */
export async function saveMedication(actor: Actor, input: MedicationInput): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (actor.kind !== "caregiver" || !can(actor, "medications:edit", { circleId: input.circleId })) {
    return { ok: false, error: "Only the caregiver can change medications." };
  }
  const db = clientFor(actor);
  const row = toRow(input);
  if (input.id) {
    const { data, error } = await db.from("medications").update(row).eq("circle_id", input.circleId).eq("id", input.id).select("id").maybeSingle();
    if (error || !data) return { ok: false, error: generic };
    return { ok: true, id: data.id as string };
  }
  const { data, error } = await db
    .from("medications")
    .insert({ ...row, circle_id: input.circleId })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: generic };
  return { ok: true, id: data.id as string };
}

/** Stopping keeps the medication on the record with today's date. Restarting clears it. */
export async function setMedicationStatus(
  actor: Actor,
  circleId: string,
  id: string,
  status: "active" | "stopped",
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (actor.kind !== "caregiver" || !can(actor, "medications:edit", { circleId })) {
    return { ok: false, error: "Only the caregiver can change medications." };
  }
  const stop_date = status === "stopped" ? new Date().toISOString().slice(0, 10) : null;
  const { data, error } = await clientFor(actor).from("medications").update({ status, stop_date }).eq("circle_id", circleId).eq("id", id).select("id").maybeSingle();
  if (error || !data) return { ok: false, error: generic };
  return { ok: true };
}
