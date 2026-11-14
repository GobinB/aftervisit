import type { MedicationChange } from "../schema";

/** Parts of a medicine line a reader can fail to read. */
export const MED_FIELDS = ["name", "dose", "instructions"] as const;
export type MedField = (typeof MED_FIELDS)[number];

export interface ReadMedication {
  kind: MedicationChange["kind"];
  name: string | null;
  dose: string | null;
  instructions: string | null;
  /** Fields the reader said it could not read. */
  unreadable: MedField[];
}

const blank = (s: string | null | undefined) => !s || !s.trim();

/**
 * The fields of a medicine that must be checked by the caregiver. A field is on the list when the
 * reader said it could not read it, and the name is always on it when it is blank. A stopped medicine
 * needs only its name; any other medicine with neither a dose nor instructions is also flagged, since
 * there is nothing to give.
 */
export function unreadableFields(med: ReadMedication): MedField[] {
  const out = new Set<MedField>(med.unreadable.filter((f) => MED_FIELDS.includes(f)));
  if (blank(med.name)) out.add("name");
  if (med.kind !== "stopped" && blank(med.dose) && blank(med.instructions)) {
    out.add("dose");
    out.add("instructions");
  }
  return MED_FIELDS.filter((f) => out.has(f));
}

/** True when the caregiver has to look at this medicine before anything is saved. */
export function medNeedsCheck(med: ReadMedication): boolean {
  return unreadableFields(med).length > 0;
}

/** "the dose", "the name and the dose", for the review screen. */
export function unreadableLabel(fields: readonly MedField[]): string {
  const words = fields.map((f) => (f === "instructions" ? "how to take it" : `the ${f}`));
  if (words.length <= 1) return words.join("");
  return `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;
}
