import { z } from "zod";

/**
 * Phone numbers as people type them: "(555) 010-0142", "555.010.0142", "+1 555 010 0142".
 * Kept as typed, so it reads the way the caregiver wrote it. The database checks the same rule
 * (migration 0022), so this message is what a person sees, not a database error.
 */
const ALLOWED = /^\+?[0-9 ().-]{6,29}$/;

export const PHONE_HINT = "Enter a phone number, like 555-010-0142, or leave it blank.";

function digits(value: string): string {
  return value.replace(/\D/g, "");
}

/** Trims and checks one number. Blank means "no number". */
export function cleanPhone(input: string | null | undefined): { ok: true; phone: string | null } | { ok: false; error: string } {
  const value = (input ?? "").trim().replace(/\s+/g, " ");
  if (!value) return { ok: true, phone: null };
  const count = digits(value).length;
  if (!ALLOWED.test(value) || count < 7 || count > 15) return { ok: false, error: PHONE_HINT };
  return { ok: true, phone: value };
}

/** For forms: a phone number, or blank to clear it. */
export const PhoneInputSchema = z
  .string()
  .max(40)
  .refine((value) => cleanPhone(value).ok, PHONE_HINT);

/**
 * The address a "Call" button dials, or null when the text has no number in it. Also used for the
 * care summary's numbers, which are free text ("555-0100, cell"): the first number in it is used.
 */
export function telHref(input: string | null | undefined): string | null {
  if (!input) return null;
  const match = input.match(/\+?[0-9][0-9 ().-]*[0-9]/);
  if (!match) return null;
  const plus = match[0].startsWith("+") ? "+" : "";
  const number = digits(match[0]);
  if (number.length < 3 || number.length > 15) return null;
  return `tel:${plus}${number}`;
}
