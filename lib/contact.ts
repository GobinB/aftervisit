/** Where families write about privacy: questions, and requests to see, copy, correct or delete. */
export const PRIVACY_EMAIL = "privacy@allhandscare.org";

/** Everything else: questions about the terms, and security reports (SECURITY.md). */
export const ADMIN_EMAIL = "admin@allhandscare.org";

/** Questions, feedback and families who want to try it. Shown on Contact, About and For care teams. */
export const CONTACT_EMAIL = ADMIN_EMAIL;

/** A mailto link with the subject filled in, so a message arrives already sorted. */
export function mailto(address: string, subject: string): string {
  return `mailto:${address}?subject=${encodeURIComponent(subject)}`;
}
