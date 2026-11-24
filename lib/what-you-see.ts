import type { Actor } from "@/lib/auth";
import { can } from "@/lib/permissions";
import type { HelperRole, Visibility } from "@/lib/schema/circles";

/**
 * What a person in the circle can open, in plain words, from their role and what the caregiver hid.
 * It asks the same permission checks the circle's menu uses, so it never promises more than the
 * person gets: a home aide on "Everything" still sees only their own reminders.
 * `who` words it for the person themselves ("your own reminders") or for the caregiver ("their own reminders").
 */
export function whatTheySee(role: HelperRole, visibility: Visibility, who: "you" | "they" = "you"): string[] {
  const circleId = "circle";
  const actor: Actor = { kind: "helper", memberId: "member", circleId, role, visibility };
  const seen: string[] = [];
  if (can(actor, "calendar:read", { circleId })) seen.push("the calendar");
  if (can(actor, "tasks:read", { circleId })) seen.push("reminders");
  else if (can(actor, "tasks:read:own", { circleId, assigneeId: actor.memberId })) seen.push(who === "you" ? "your own reminders" : "their own reminders");
  if (can(actor, "medications:read", { circleId })) seen.push("medications");
  if (can(actor, "summary:read", { circleId })) seen.push("the care summary");
  if (can(actor, "visits:read", { circleId })) seen.push("visit notes");
  return seen;
}

/** "the calendar, reminders and medications". Nothing shared reads "nothing yet". */
export function seenText(seen: readonly string[]): string {
  if (!seen.length) return "nothing yet";
  if (seen.length === 1) return seen[0];
  return `${seen.slice(0, -1).join(", ")} and ${seen[seen.length - 1]}`;
}

/** The same, starting with a capital, for a line of its own. */
export function seenSentence(seen: readonly string[]): string {
  const text = seenText(seen);
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** "Lena" from "Lena Ortiz". */
export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name.trim();
}

/** "Teodora Ruiz's circle". */
export function circleOf(personName: string): string {
  return `${personName.trim()}'s circle`;
}
