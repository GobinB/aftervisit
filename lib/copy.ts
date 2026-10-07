/**
 * Microcopy (Section 8). Voice: calm, plain, second person, no exclamation marks,
 * no jargon, "the clinic" rather than "your provider".
 */
import { possessive, shortDate, shortProvider } from "./format";
import type { HandoffPayload } from "./schema";

export const COPY = {
  uploadType: "That file type is not supported yet. Please upload a PDF or a photo (JPG, PNG, HEIC).",
  uploadSize: (mb: number) => `That file is larger than ${mb} MB. Try a photo of each page instead.`,
  nothingParsed:
    "We could not sort that summary into sections automatically. Everything we read is under Other notes below so you can place it, or try a clearer photo.",
  scannedPdf: "This PDF looks like a scan. Take a photo of each page instead and we will read it on your phone.",
  lowConfidenceBadge: "Please check this",
  lowConfidenceHelper: "The summary was not clear here. Edit it, or tap Accept if it is right.",
  removed: "Removed.",
  sectionReviewed: "I've reviewed this section",
  confirmIncomplete: (n: number) => `Review all ${n} sections to continue`,
  shareSuccess: "Your handoff is ready. Only people with this link can see it.",
  pinHelper: "Share the PIN separately, by voice or a different message.",
  pinWrong: (left: number) => `That PIN does not match. ${left} ${left === 1 ? "attempt" : "attempts"} left.`,
  pinLocked: "Too many attempts. Try again in 10 minutes.",
  expired: "This care update has expired. Links last 30 days to keep health information from lingering online.",
  deleted: "This care update was deleted by the person who created it.",
  revoked: "The person who shared this care update removed access for this link.",
  notFound: "This link is not valid. Check that it was copied in full.",
  ackSuccess: (name: string, creator?: string) =>
    `Thanks, ${name}. ${creator ? creator : "The person who shared this"} will see that you've read this.`,
  emptySection: "The summary did not mention any. Add one if you know of something.",
  consentRequired: "Please confirm you have permission to share this information.",
  consentLabel:
    "I am the patient, or I have the patient's permission or legal authority to share this information with the people above.",
  linkAccess:
    "Each person gets their own link, and sees only what you choose. You can remove anyone's access later. Anyone who has a person's link can open it, which is why a PIN is on by default.",
  pinDefaultHelper:
    "Anyone with the link will also need this PIN. Send it separately, by voice or a different message. A PIN adds protection; it does not confirm who someone is.",
  pinOffWarning: "Without a PIN, anyone who has one of these links can open it.",
  rateLimited: "You have done that a lot in the last hour. Please wait a little and try again.",
  genericError: "Something went wrong on our side. Your work is still here; please try again.",
  offline: "We could not reach AfterVisit. Check your connection and try again.",
  notMedicalAdvice: "Not medical advice. AfterVisit organizes what your clinician wrote; it does not interpret it.",
};

export function visitTitle(p: HandoffPayload): string {
  const who = p.visit.patientFirstName;
  const when = shortDate(p.visit.date);
  if (who && when) return `${possessive(who)} visit on ${when}`;
  if (who) return `${possessive(who)} visit`;
  if (when) return `Visit on ${when}`;
  return "Visit summary";
}

/** Link preview title. No medical detail. */
export function ogTitle(p: Pick<HandoffPayload, "visit">): string {
  const who = p.visit.patientFirstName;
  const when = shortDate(p.visit.date);
  if (who && when) return `Care update for ${who}, ${when} visit`;
  if (who) return `Care update for ${who}`;
  return "Care update";
}

function visitPhrase(p: HandoffPayload): string {
  const prov = shortProvider(p.visit.provider);
  const when = shortDate(p.visit.date);
  return [when ? `the ${when} visit` : "a recent visit", prov ? `with ${prov}` : ""].filter(Boolean).join(" ");
}

function covers(p: HandoffPayload): string {
  const parts: string[] = [];
  if (p.medications.some((m) => m.kind !== "continue")) parts.push(p.medications.filter((m) => m.kind !== "continue").length > 1 ? "the medication changes" : "the medication change");
  if (p.tasks.length) parts.push("what needs to happen next");
  if (!parts.length) parts.push("what the clinic said");
  return parts.join(" and ");
}

export function smsBody(p: HandoffPayload, link: string, hasPin: boolean, to?: string): string {
  const who = p.visit.patientFirstName;
  return `${to ? `Hi ${to}, here is your c` : "C"}are update${who ? ` for ${who}` : ""} from ${visitPhrase(p)}. It covers ${covers(p)}: ${link}${hasPin ? "  (PIN sent separately)" : ""}`;
}

export function emailSubject(p: HandoffPayload): string {
  const who = p.visit.patientFirstName;
  const when = shortDate(p.visit.date);
  return `Care update${who ? ` for ${who}` : ""}${when ? ` - ${when} visit` : ""}`;
}

export function emailBody(p: HandoffPayload, link: string, creator: string | undefined, hasPin: boolean, to?: string): string {
  const who = p.visit.patientFirstName;
  const prov = shortProvider(p.visit.provider);
  const when = shortDate(p.visit.date);
  const visit = `${who ? `${possessive(who)} visit` : "the visit"}${prov ? ` with ${prov}` : ""}${when ? ` on ${when}` : ""}`;
  return [
    to ? `Hi ${to},` : "Hi,",
    `Here is a short summary of ${visit}, including what changed and what needs to happen next. Please open it and tap "I've read this" at the bottom.`,
    `Your personal link (please don't forward it): ${link}`,
    hasPin ? "I will send you the PIN separately." : "",
    "",
    creator ? `Thanks, ${creator}` : "Thanks",
  ]
    .filter((l, i, a) => l !== "" || (i > 0 && a[i - 1] !== ""))
    .join("\n");
}
