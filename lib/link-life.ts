/**
 * How long a person's link keeps working (docs/decisions/0003-helper-links.md). Shared by the
 * server, which sets the date, and the screens, which show it.
 * - It stops 30 days after it was last opened (or made, if it was never opened).
 * - It always stops 90 days after it was made. Then the caregiver sends a fresh one.
 */
export const LINK_IDLE_DAYS = 30;
export const LINK_MAX_DAYS = 90;

const DAY = 24 * 60 * 60 * 1000;

/** When a link made at `issuedAt` stops working, if it is opened (or made) at `now`. */
export function linkExpiry(issuedAt: Date, now: Date = new Date()): Date {
  return new Date(Math.min(issuedAt.getTime() + LINK_MAX_DAYS * DAY, now.getTime() + LINK_IDLE_DAYS * DAY));
}

/** The areas a change can be in, as the database records them (circle_updates.area). */
export const UPDATE_AREAS = ["medications", "calendar", "tasks", "summary"] as const;
export type UpdateArea = (typeof UPDATE_AREAS)[number];

export const UPDATE_AREA_WORDS: Record<UpdateArea, string> = {
  medications: "medicines",
  calendar: "the calendar",
  tasks: "reminders",
  summary: "the care summary",
};

/** "medicines", "medicines and the calendar", "medicines, reminders and the calendar". */
export function changedWords(areas: readonly UpdateArea[]): string {
  const words = UPDATE_AREAS.filter((area) => areas.includes(area)).map((area) => UPDATE_AREA_WORDS[area]);
  if (words.length <= 1) return words[0] ?? "";
  return `${words.slice(0, -1).join(", ")} and ${words.at(-1)}`;
}
