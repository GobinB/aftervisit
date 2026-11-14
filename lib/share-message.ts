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
  return `sms:?&body=${encodeURIComponent(shareMessage(details).body)}`;
}

/** Simple choices for what a person sees, instead of a row of bare checkboxes. */
export const SEE_PRESETS = [
  { key: "everything", label: "Everything", detail: "Calendar, reminders, medications and the care summary", hidden: [] as VisibilityArea[] },
  { key: "calendar", label: "Calendar and reminders only", detail: "Good for neighbors, friends and aides", hidden: ["medications", "summary"] as VisibilityArea[] },
] as const;

export const AREA_DETAILS: Partial<Record<VisibilityArea, string>> = {
  calendar: "Appointments, and who is going",
  tasks: "Things to do, and taking one on",
  medications: "What is taken, and when",
  summary: "Allergies, doctors and who to call",
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
