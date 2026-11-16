import type { HelperRole, VisibilityArea } from "@/lib/schema/circles";

/**
 * `changed` is for the message sent after the caregiver changes something: it says what changed
 * ("medicines and the calendar"). The link is the same one the person already has.
 * `hasPin`: the person has a PIN, which is never shown again, so the message only reminds them of it.
 */
export type ShareDetails = { name: string; personName?: string; url: string; pin?: string | null; hasPin?: boolean; changed?: string };

/** The ready-written message for a person's link. A new PIN goes in it; an existing one is only mentioned. */
export function shareMessage({ name, personName, url, pin, hasPin, changed }: ShareDetails): { subject: string; body: string } {
  const first = name.trim().split(/\s+/)[0] || name.trim();
  const circle = personName ? `${personName}'s care circle` : "our care circle";
  const lines = [
    `Hi ${first},`,
    "",
    changed
      ? `I updated ${circle} on All Hands Care: ${changed} changed. Have a look here (it is the same link as before):`
      : `This is your own link to ${circle} on All Hands Care. It shows the calendar, reminders and other things I have shared with you.`,
    "",
    url,
  ];
  if (pin) lines.push("", `Your PIN is ${pin}.`);
  else if (hasPin) lines.push("", "Use the same PIN as before.");
  if (!changed) lines.push("", "Tip: open it on your phone and add it to your Home Screen to find it again.");
  const subject = personName ? `${personName}'s care circle` : "Your care circle link";
  return { subject: changed ? `${subject}: ${changed} changed` : subject, body: lines.join("\n") };
}

export function mailtoHref(email: string | null | undefined, details: ShareDetails): string {
  const { subject, body } = shareMessage(details);
  return `mailto:${email ? encodeURIComponent(email) : ""}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/** "sms:?&body=" opens the Messages app with the text filled in on both iPhone and Android. */
export function smsHref(details: ShareDetails): string {
  return smsTo(null, shareMessage(details).body);
}

/**
 * A text with the body filled in, to a number when there is one ("sms:5550100142?&body=" works on
 * iPhone and Android). Without a number the caregiver picks who it goes to.
 */
export function smsTo(phone: string | null | undefined, body: string): string {
  const digits = (phone ?? "").replace(/\D/g, "");
  const to = digits.length >= 7 ? `${(phone ?? "").trim().startsWith("+") ? "+" : ""}${digits}` : "";
  return `sms:${to}?&body=${encodeURIComponent(body)}`;
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** "Tuesday, November 24 at 10:30 AM" for "2026-11-24" and "10:30"; the day alone when there is no time. */
export function whenText(date: string, time?: string | null): string {
  const d = new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return "";
  const day = `${DAYS[d.getUTCDay()]}, ${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCDate()}`;
  const match = /^(\d{2}):(\d{2})/.exec(time ?? "");
  if (!match) return day;
  const hour24 = Number(match[1]);
  const hour = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${day} at ${hour}:${match[2]} ${hour24 < 12 ? "AM" : "PM"}`;
}

/**
 * What one person was put down for when a visit updated the circle: appointments they are going to
 * (by date and time) and how many reminders are theirs.
 */
export type Assigned = { appointments: { date: string; time?: string | null }[]; reminders: number };

/** "Going to 1 appointment · 2 reminders", for the caregiver's own screen. */
export function assignedSummary({ appointments, reminders }: Assigned): string {
  const parts = [
    appointments.length ? `Going to ${appointments.length} appointment${appointments.length === 1 ? "" : "s"}` : null,
    reminders ? `${reminders} reminder${reminders === 1 ? "" : "s"}` : null,
  ].filter(Boolean);
  return parts.join(" · ");
}

/**
 * The text a person gets after a visit puts them down for something. It says when, never what the
 * appointment is for or what a reminder says: a text message is not private, so the health details
 * stay behind their link. A person added just now gets a welcome; someone already in the circle is
 * told it is the same link as before.
 */
export function assignedMessage({
  name,
  personName,
  url,
  isNew,
  hasPin,
  assigned,
}: {
  name: string;
  personName: string;
  url: string;
  isNew: boolean;
  hasPin?: boolean;
  assigned: Assigned;
}): string {
  const first = name.trim().split(/\s+/)[0] || name.trim();
  const circle = `${personName}'s care circle`;
  const items = [
    ...assigned.appointments.map((appt) => `- Going with ${personName} to an appointment on ${whenText(appt.date, appt.time)}`),
    ...(assigned.reminders ? [`- ${assigned.reminders} reminder${assigned.reminders === 1 ? "" : "s"} to take care of`] : []),
  ];
  const lines = [`Hi ${first},`, ""];
  if (items.length) {
    lines.push(isNew ? `I added you to ${circle} on All Hands Care and put you down for:` : `I updated ${circle} on All Hands Care and put you down for:`, ...items, "");
    lines.push(isNew ? "The details are on your own link. No account or password needed:" : "The details are on your link (the same link as before):");
  } else {
    lines.push(`I added you to ${circle} on All Hands Care. This is your own link. No account or password needed:`);
  }
  lines.push(url);
  if (hasPin) lines.push("", "Use the same PIN as before.");
  if (isNew) lines.push("", "Tip: open it on your phone and add it to your Home Screen to find it again.");
  return lines.join("\n");
}

/** Simple choices for what a person sees, instead of a row of bare checkboxes. */
export const SEE_PRESETS = [
  { key: "everything", label: "Everything", detail: "Calendar, reminders, medications, the care summary and visit notes", hidden: [] as VisibilityArea[] },
  { key: "calendar", label: "Calendar and reminders only", detail: "Good for neighbors, friends and aides", hidden: ["medications", "summary", "handoff"] as VisibilityArea[] },
] as const;

export const AREA_DETAILS: Partial<Record<VisibilityArea, string>> = {
  calendar: "Appointments, and who is going",
  tasks: "Things to do, and taking one on",
  medications: "What is taken, and when",
  summary: "Allergies, doctors and who to call",
  handoff: "What to watch for and good to know after a visit",
};

/** Which preset matches a hidden list, or "custom". */
export function presetFor(hidden: readonly string[]): string {
  const sorted = [...hidden].sort().join(",");
  return SEE_PRESETS.find((preset) => [...preset.hidden].sort().join(",") === sorted)?.key ?? "custom";
}

export const ROLE_DETAILS: Record<HelperRole, string> = {
  family: "Can add to the calendar and take on reminders",
  care_manager: "Sees what you share and can take on reminders",
  home_aide: "Sees their own reminders and the calendar",
  day_program: "Sees their own reminders and the calendar",
};
