import { z } from "zod";
import { clockTime } from "@/lib/schema/medications";

export const REPEATS = ["none", "daily", "weekly", "every_2_weeks", "monthly", "yearly"] as const;
export type Repeat = (typeof REPEATS)[number];
export const REPEAT_LABELS: Record<Repeat, string> = {
  none: "Does not repeat",
  daily: "Every day",
  weekly: "Every week",
  every_2_weeks: "Every 2 weeks",
  monthly: "Every month",
  yearly: "Every year",
};

/** Who is going: nobody yet, ask for a volunteer, the caregiver, or one person with a link (their member id). */
export const GoingSchema = z.union([z.literal("none"), z.literal("volunteer"), z.literal("caregiver"), z.string().uuid()]);

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const clock = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value ? value : undefined));

export const EventInputSchema = z
  .object({
    circleId: z.string().uuid(),
    id: z.string().uuid().optional(),
    title: z.string().trim().min(1, "Write what it is.").max(200),
    date: isoDate,
    startTime: clock.optional().or(z.literal("").transform(() => undefined)),
    endTime: clock.optional().or(z.literal("").transform(() => undefined)),
    location: optionalText(300),
    notes: optionalText(1000),
    repeat: z.enum(REPEATS).default("none"),
    repeatUntil: isoDate.optional().or(z.literal("").transform(() => undefined)),
    going: GoingSchema.default("none"),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.endTime && (!value.startTime || value.endTime <= value.startTime)) {
      ctx.addIssue({ code: "custom", path: ["endTime"], message: "The end time must be after the start time." });
    }
    if (value.repeatUntil && (value.repeat === "none" || value.repeatUntil < value.date)) {
      ctx.addIssue({ code: "custom", path: ["repeatUntil"], message: "Repeats must end on or after the first date." });
    }
  });
export type EventInput = z.infer<typeof EventInputSchema>;

export const EventChangeSchema = z.object({ circleId: z.string().uuid(), id: z.string().uuid() }).strict();

export type CareEvent = {
  id: string;
  title: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  location: string | null;
  notes: string | null;
  repeat: Repeat;
  repeatUntil: string | null;
  going: { kind: "caregiver" } | { kind: "member"; memberId: string } | null;
  needsVolunteer: boolean;
};

/** One day an event happens on. */
export type Occurrence = { event: CareEvent; date: string };

function toDate(iso: string): Date {
  return new Date(`${iso}T12:00:00Z`);
}
function toIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}
export function addDays(iso: string, days: number): string {
  const d = toDate(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return toIso(d);
}
function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

/**
 * The dates an event falls on between from and to (inclusive). A monthly event on the 31st skips
 * shorter months, and a yearly one on February 29 happens only in leap years, rather than moving.
 */
export function occurrences(event: CareEvent, from: string, to: string, max = 400): string[] {
  const last = event.repeatUntil && event.repeatUntil < to ? event.repeatUntil : to;
  if (event.repeat === "none") return event.date >= from && event.date <= to ? [event.date] : [];
  const dates: string[] = [];
  const start = toDate(event.date);
  const day = start.getUTCDate();
  for (let i = 0; dates.length < max; i++) {
    let iso: string | null;
    if (event.repeat === "daily") iso = addDays(event.date, i);
    else if (event.repeat === "weekly") iso = addDays(event.date, i * 7);
    else if (event.repeat === "every_2_weeks") iso = addDays(event.date, i * 14);
    else if (event.repeat === "monthly") {
      const month = start.getUTCMonth() + i;
      const year = start.getUTCFullYear() + Math.floor(month / 12);
      const m = ((month % 12) + 12) % 12;
      iso = day <= daysInMonth(year, m) ? toIso(new Date(Date.UTC(year, m, day, 12))) : null;
    } else {
      const year = start.getUTCFullYear() + i;
      const m = start.getUTCMonth();
      iso = day <= daysInMonth(year, m) ? toIso(new Date(Date.UTC(year, m, day, 12))) : null;
    }
    if (iso === null) continue;
    if (iso > last) break;
    if (iso >= from) dates.push(iso);
  }
  return dates;
}

/** Every occurrence of every event in the range, in date and time order. */
export function expand(events: CareEvent[], from: string, to: string): Occurrence[] {
  return events
    .flatMap((event) => occurrences(event, from, to).map((date) => ({ event, date })))
    .sort((a, b) => a.date.localeCompare(b.date) || (a.event.startTime ?? "").localeCompare(b.event.startTime ?? "") || a.event.title.localeCompare(b.event.title));
}

/** "All day", "10:30 AM", "9 AM to 10 AM". */
export function timeText(event: Pick<CareEvent, "startTime" | "endTime">): string {
  if (!event.startTime) return "All day";
  return event.endTime ? `${clockTime(event.startTime)} to ${clockTime(event.endTime)}` : clockTime(event.startTime);
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** "Wed, Nov 6" */
export function dayText(iso: string): string {
  const d = toDate(iso);
  return `${WEEKDAYS[d.getUTCDay()]}, ${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

/** "November 2026" from "2026-11". */
export function monthText(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return `${MONTHS_LONG[(m ?? 1) - 1]} ${y}`;
}

export function shiftMonth(month: string, by: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, (m ?? 1) - 1 + by, 1, 12));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** The weeks of a month for a grid starting on Sunday, padded with the days around it. */
export function monthGrid(month: string): string[][] {
  const first = toDate(`${month}-01`);
  const start = addDays(`${month}-01`, -first.getUTCDay());
  const weeks: string[][] = [];
  for (let w = 0; w < 6; w++) {
    const week = Array.from({ length: 7 }, (_, d) => addDays(start, w * 7 + d));
    if (w >= 4 && !week.some((iso) => iso.startsWith(month))) break;
    weeks.push(week);
  }
  return weeks;
}
