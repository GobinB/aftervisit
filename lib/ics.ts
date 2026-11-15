import type { CareEvent, Repeat } from "@/lib/schema/events";
import { doseText, scheduleText, type Medication } from "@/lib/schema/medications";

/**
 * A circle's calendar as an iCalendar file (RFC 5545), for Google Calendar, Apple Calendar and
 * Outlook to subscribe to. Times are "floating": a 10:30 appointment shows at 10:30 in whatever
 * time zone the reader's calendar uses, the same wall-clock time the circle stores and the Calendar
 * page shows. Medicine times work the same way.
 */
export type FeedReminder = { id: string; title: string; dueDate: string; who: string | null };
export type FeedMedicine = Pick<
  Medication,
  "id" | "name" | "dose" | "amount" | "form" | "schedule" | "every" | "weekdays" | "times" | "startDate" | "stopDate" | "status" | "updatedAt"
>;

const RRULE: Record<Exclude<Repeat, "none">, string> = {
  daily: "FREQ=DAILY",
  weekly: "FREQ=WEEKLY",
  every_2_weeks: "FREQ=WEEKLY;INTERVAL=2",
  monthly: "FREQ=MONTHLY",
  yearly: "FREQ=YEARLY",
};

/** Backslash, semicolon, comma and line breaks are escaped in text values. */
export function escapeText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Lines longer than 75 bytes are folded: a line break, then a space, never splitting a character. */
export function foldLine(line: string): string {
  const out: string[] = [];
  let current = "";
  let bytes = 0;
  for (const char of line) {
    const size = new TextEncoder().encode(char).length;
    const limit = out.length === 0 ? 75 : 74;
    if (bytes + size > limit) {
      out.push(current);
      current = "";
      bytes = 0;
    }
    current += char;
    bytes += size;
  }
  out.push(current);
  return out.join("\r\n ");
}

const date = (iso: string) => iso.replace(/-/g, "");
const dateTime = (iso: string, clock: string) => `${date(iso)}T${clock.replace(":", "")}00`;
const addDays = (iso: string, days: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
const nextDay = (iso: string) => addDays(iso, 1);
const weekdayOf = (iso: string) => new Date(`${iso}T12:00:00Z`).getUTCDay();
/** "20261106T153000Z", for DTSTAMP. */
const stamp = (now: Date) => now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

function addMinutes(clock: string, minutes: number): string {
  const [h, m] = clock.split(":").map(Number);
  const total = Math.min(h * 60 + m + minutes, 23 * 60 + 59);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function eventLines(event: CareEvent, whoIsGoing: string | null, host: string, now: Date): string[] {
  const lines = ["BEGIN:VEVENT", `UID:${event.id}@${host}`, `DTSTAMP:${stamp(now)}`];
  if (event.startTime) {
    lines.push(`DTSTART:${dateTime(event.date, event.startTime)}`);
    lines.push(`DTEND:${dateTime(event.date, event.endTime ?? addMinutes(event.startTime, 60))}`);
  } else {
    lines.push(`DTSTART;VALUE=DATE:${date(event.date)}`, `DTEND;VALUE=DATE:${date(nextDay(event.date))}`);
  }
  if (event.repeat !== "none") {
    const until = event.repeatUntil ? (event.startTime ? `;UNTIL=${date(event.repeatUntil)}T235959` : `;UNTIL=${date(event.repeatUntil)}`) : "";
    lines.push(`RRULE:${RRULE[event.repeat]}${until}`);
  }
  lines.push(`SUMMARY:${escapeText(event.title)}`);
  if (event.location) lines.push(`LOCATION:${escapeText(event.location)}`);
  const notes = [whoIsGoing ? `${whoIsGoing} is going.` : event.needsVolunteer ? "Needs someone to go." : null, event.notes].filter(Boolean).join("\n");
  if (notes) lines.push(`DESCRIPTION:${escapeText(notes)}`);
  lines.push("END:VEVENT");
  return lines;
}

const BYDAY = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"] as const;
/** How long a medicine entry lasts in the calendar app: long enough to see, short enough to stay out of the way. */
const MED_MINUTES = 15;

/**
 * One repeating entry per time of day for a medicine, on the same days the Calendar page shows it
 * (lib/med-days.ts `medsOnDay`): from the start date (or, with none, the day it was last changed),
 * and up to the day before it was stopped. "Only when needed" medicines have no days and stay out,
 * and so does a stopped one with no stop date. A medicine with a schedule but no time of day
 * becomes an all-day entry, as the Calendar page lists it under "Any time".
 */
export function medicineLines(med: FeedMedicine, host: string, now: Date): string[] {
  if (med.schedule === "as_needed") return [];
  if (med.status === "stopped" && !med.stopDate) return [];
  const every = Math.max(1, med.every ?? 1);
  const interval = every > 1 ? `;INTERVAL=${every}` : "";
  let first = med.startDate ?? med.updatedAt.slice(0, 10);
  let rule: string;
  switch (med.schedule) {
    case "daily":
      rule = "FREQ=DAILY";
      break;
    case "every_x_days":
      rule = `FREQ=DAILY${interval}`;
      break;
    case "weekdays": {
      const days = [...new Set(med.weekdays)].filter((day) => day >= 0 && day <= 6).sort((a, b) => a - b);
      if (!days.length) return [];
      // The first entry must itself fall on one of the days, or calendar apps add an extra one.
      while (!days.includes(weekdayOf(first))) first = nextDay(first);
      rule = `FREQ=WEEKLY;BYDAY=${days.map((day) => BYDAY[day]).join(",")}`;
      break;
    }
    case "every_x_weeks":
      rule = `FREQ=WEEKLY${interval}`;
      break;
    case "every_x_months":
      rule = `FREQ=MONTHLY${interval}`;
      break;
  }
  const last = med.status === "stopped" && med.stopDate ? addDays(med.stopDate, -1) : null;
  if (last && last < first) return [];

  const dose = doseText(med);
  const summary = escapeText(dose ? `${med.name} · ${dose}` : med.name);
  const description = escapeText(scheduleText(med));
  const modified = new Date(med.updatedAt);
  const common = (uid: string) => [
    "BEGIN:VEVENT",
    `UID:${uid}@${host}`,
    `DTSTAMP:${stamp(now)}`,
    ...(Number.isNaN(modified.getTime()) ? [] : [`LAST-MODIFIED:${stamp(modified)}`]),
  ];
  const tail = [`SUMMARY:${summary}`, `DESCRIPTION:${description}`, "CATEGORIES:Medicine", "TRANSP:TRANSPARENT", "END:VEVENT"];

  const times = [...new Set(med.times)].filter((time) => /^([01]\d|2[0-3]):[0-5]\d$/.test(time)).sort();
  if (!times.length) {
    return [
      ...common(`med-${med.id}`),
      `DTSTART;VALUE=DATE:${date(first)}`,
      `DTEND;VALUE=DATE:${date(nextDay(first))}`,
      `RRULE:${rule}${last ? `;UNTIL=${date(last)}` : ""}`,
      ...tail,
    ];
  }
  return times.flatMap((time) => {
    const [h, m] = time.split(":").map(Number);
    const endTotal = h * 60 + m + MED_MINUTES;
    const endDay = endTotal >= 24 * 60 ? nextDay(first) : first;
    const endClock = `${String(Math.floor(endTotal / 60) % 24).padStart(2, "0")}:${String(endTotal % 60).padStart(2, "0")}`;
    return [
      ...common(`med-${med.id}-${time.replace(":", "")}`),
      `DTSTART:${dateTime(first, time)}`,
      `DTEND:${dateTime(endDay, endClock)}`,
      `RRULE:${rule}${last ? `;UNTIL=${date(last)}T235959` : ""}`,
      ...tail,
    ];
  });
}

function reminderLines(reminder: FeedReminder, host: string, now: Date): string[] {
  return [
    "BEGIN:VEVENT",
    `UID:reminder-${reminder.id}@${host}`,
    `DTSTAMP:${stamp(now)}`,
    `DTSTART;VALUE=DATE:${date(reminder.dueDate)}`,
    `DTEND;VALUE=DATE:${date(nextDay(reminder.dueDate))}`,
    `SUMMARY:${escapeText(`Reminder: ${reminder.title}`)}`,
    ...(reminder.who ? [`DESCRIPTION:${escapeText(`${reminder.who} is doing this.`)}`] : []),
    "TRANSP:TRANSPARENT",
    "END:VEVENT",
  ];
}

/** The whole file, with CRLF line endings as the standard requires. */
export function buildCalendar({
  name,
  events,
  reminders,
  medicines = [],
  goingName,
  host,
  now = new Date(),
}: {
  name: string;
  events: CareEvent[];
  reminders: FeedReminder[];
  /** Left empty when the caregiver turned medicines off for this link. */
  medicines?: FeedMedicine[];
  goingName: (event: CareEvent) => string | null;
  host: string;
  now?: Date;
}): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//All Hands Care//Care circle calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(name)}`,
    // Ask calendar apps to check again every hour (most decide for themselves).
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
    ...events.flatMap((event) => eventLines(event, goingName(event), host, now)),
    ...reminders.flatMap((reminder) => reminderLines(reminder, host, now)),
    ...medicines.flatMap((med) => medicineLines(med, host, now)),
    "END:VCALENDAR",
  ];
  return lines.map(foldLine).join("\r\n") + "\r\n";
}

/** Links that open each calendar app's "subscribe" screen with this feed already filled in. */
export function subscribeLinks(feedUrl: string, name: string) {
  const webcal = feedUrl.replace(/^https?:\/\//, "webcal://");
  return {
    google: `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(webcal)}`,
    apple: webcal,
    outlook: `https://outlook.live.com/calendar/0/addfromweb?url=${encodeURIComponent(feedUrl)}&name=${encodeURIComponent(name)}`,
  };
}
