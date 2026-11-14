import type { ZodError } from "zod";

const NAME_EMPTY = "Enter the name of the person you care for.";
const NAME_LONG = "Their name is too long.";

export type SummaryRow = { name: string; extra: string; phone: string };

export type CareSummaryInput = {
  allergies: string;
  doctors: SummaryRow[];
  pharmacyName: string;
  pharmacyPhone: string;
  pharmacyAddress: string;
  contacts: SummaryRow[];
  poa: string;
};

/** Step 0. Empty and over-long names are rejected before the next step. */
export function personNameError(value: string): string | null {
  const name = value.trim();
  if (!name) return NAME_EMPTY;
  if (name.length > 120) return NAME_LONG;
  return null;
}

function filled(row: SummaryRow): boolean {
  return Boolean(row.name.trim() || row.extra.trim() || row.phone.trim());
}

/**
 * Step 1. The same limits as CircleContentSchema, checked before the form leaves this step.
 * A row with a specialty or phone and no name is an error, so those words are not dropped.
 */
export function careSummaryError(input: CareSummaryInput): string | null {
  const allergies = input.allergies
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (allergies.length > 50) return "That is too many allergies.";
  if (allergies.some((line) => line.length > 200)) return "An allergy is too long.";

  const doctors = input.doctors.filter(filled);
  if (doctors.length > 30) return "That is too many doctors.";
  for (const row of doctors) {
    if (!row.name.trim()) return "Enter the doctor's name, or clear that row.";
    if (row.name.trim().length > 120) return "A doctor's name is too long.";
    if (row.extra.trim().length > 80) return "A specialty is too long.";
    if (row.phone.trim().length > 40) return "A doctor's phone number is too long.";
  }

  const pharmacyName = input.pharmacyName.trim();
  const pharmacyPhone = input.pharmacyPhone.trim();
  const pharmacyAddress = input.pharmacyAddress.trim();
  if ((pharmacyPhone || pharmacyAddress) && !pharmacyName) return "Enter the pharmacy name, or clear the phone and address.";
  if (pharmacyName.length > 120) return "The pharmacy name is too long.";
  if (pharmacyPhone.length > 40) return "The pharmacy phone number is too long.";
  if (pharmacyAddress.length > 200) return "The pharmacy address is too long.";

  const contacts = input.contacts.filter(filled);
  if (contacts.length > 20) return "That is too many emergency contacts.";
  for (const row of contacts) {
    if (!row.name.trim()) return "Enter the contact's name, or clear that row.";
    if (row.name.trim().length > 80) return "A contact's name is too long.";
    if (row.extra.trim().length > 80) return "A relationship is too long.";
    if (row.phone.trim().length > 40) return "A contact's phone number is too long.";
  }

  if (input.poa.trim().length > 300) return "Where the power of attorney is kept is too long.";
  return null;
}

/** Which step of the new-circle form holds this field. */
export function stepForCreatePath(path: readonly PropertyKey[]): 0 | 1 | 2 | null {
  const [root, field] = path;
  if (root === "content") {
    if (field === "person_name") return 0;
    if (
      field === "allergies" ||
      field === "doctors" ||
      field === "pharmacy" ||
      field === "emergency_contacts" ||
      field === "poa_location"
    ) {
      return 1;
    }
    return 1;
  }
  if (root === "consents") return 2;
  return null;
}

function messageForPath(path: readonly PropertyKey[], code: string): string {
  const field = path[1];
  if (path[0] === "content" && field === "person_name") return code === "too_big" ? NAME_LONG : NAME_EMPTY;
  if (path[0] === "content" && field === "allergies") return "Check the allergies and try again.";
  if (path[0] === "content" && field === "doctors") return "Check the doctors and try again.";
  if (path[0] === "content" && field === "pharmacy") return "Check the pharmacy and try again.";
  if (path[0] === "content" && field === "emergency_contacts") return "Check the emergency contacts and try again.";
  if (path[0] === "content" && field === "poa_location") return "Where the power of attorney is kept is too long.";
  if (path[0] === "consents") return "Confirm each statement to continue.";
  return "Check the form and try again.";
}

/** A server-side schema failure, pointed at the step that holds the field. */
export function explainCreateFailure(error: ZodError): { error: string; step: 0 | 1 | 2 } {
  const issue = error.issues[0];
  const step = (issue && stepForCreatePath(issue.path)) ?? 1;
  return { error: messageForPath(issue?.path ?? [], issue?.code ?? ""), step };
}
