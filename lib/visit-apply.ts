import type { MedicationChange } from "@/lib/schema";
import type { Medication, MedSchedule } from "@/lib/schema/medications";

/** What confirming a visit does to one medication on the circle's list. */
export type MedPlan =
  | { draftId: string; action: "add"; name: string; detail: string; reason?: string; dose: string | null; schedule: MedSchedule }
  | { draftId: string; action: "stop"; name: string; medId: string; current: string }
  | { draftId: string; action: "update"; name: string; medId: string; detail: string; from: string | null; to: string | null }
  | { draftId: string; action: "keep"; name: string; medId: string }
  | { draftId: string; action: "absent"; name: string }
  | { draftId: string; action: "missing"; name: string; detail: string; reason?: string; dose: string | null; schedule: MedSchedule };

const STRENGTH = /(\d+(?:[.,]\d+)?)\s*(mcg|mg|g|ml|mL|units?|IU|%)/i;

/** "20 mg once daily (was 10 mg)" -> "20 mg". The first strength in the clinic's words, or null. */
export function strengthOf(detail: string): string | null {
  const match = STRENGTH.exec(detail);
  if (!match) return null;
  const unit = match[2].toLowerCase() === "ml" ? "mL" : match[2].toLowerCase() === "iu" ? "IU" : match[2].toLowerCase().replace(/^units?$/, "units");
  return `${match[1]} ${unit}`;
}

/** Only "as needed" is read from the words; everything else starts as every day, for the caregiver to check. */
export function scheduleOf(detail: string): MedSchedule {
  return /\b(as needed|prn|when needed|if needed)\b/i.test(detail) ? "as_needed" : "daily";
}

function key(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/** Finds the medication on the list with the same name, or the same first word ("Metformin ER" and "metformin"). */
export function findMatch(name: string, current: Medication[]): Medication | undefined {
  const active = current.filter((med) => med.status === "active");
  const wanted = key(name);
  const exact = active.find((med) => key(med.name) === wanted);
  if (exact) return exact;
  const first = wanted.split(" ")[0];
  if (!first || first.length < 4) return undefined;
  return active.find((med) => key(med.name).split(" ")[0] === first);
}

/** Lines each medication change from the visit up with the circle's current list. */
export function planMedications(changes: MedicationChange[], current: Medication[]): MedPlan[] {
  return changes
    .filter((change) => change.name.trim())
    .map((change): MedPlan => {
      const match = findMatch(change.name, current);
      const base = { draftId: change.id, name: change.name.trim() };
      const added = { detail: change.detail, reason: change.reason, dose: strengthOf(change.detail), schedule: scheduleOf(change.detail) };
      switch (change.kind) {
        case "new":
          return match
            ? { ...base, action: "update", medId: match.id, detail: change.detail, from: match.dose, to: strengthOf(change.detail) ?? match.dose }
            : { ...base, action: "add", ...added };
        case "dose_changed":
          return match
            ? { ...base, action: "update", medId: match.id, detail: change.detail, from: match.dose, to: strengthOf(change.detail) ?? match.dose }
            : { ...base, action: "add", ...added };
        case "stopped":
          return match ? { ...base, action: "stop", medId: match.id, current: [match.name, match.dose].filter(Boolean).join(" ") } : { ...base, action: "absent" };
        case "continue":
          return match ? { ...base, action: "keep", medId: match.id } : { ...base, action: "missing", ...added };
      }
    });
}
