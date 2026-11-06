import type { CareEvent, Repeat } from "@/lib/schema/events";

/**
 * A circle's calendar as an iCalendar file (RFC 5545), for Google Calendar, Apple Calendar and
 * Outlook to subscribe to. Times are "floating": a 10:30 appointment shows at 10:30 in whatever
 * time zone the reader's calendar uses, the same wall-clock time the circle stores.
 */
export type FeedReminder = { id: string; title: string; dueDate: string; who: string | null };

const RRULE: Record<Exclude<Repeat, "none">, string> = {
  daily: "FREQ=DAILY",
  weekly: "FREQ=WEEKLY",
  every_2_weeks: "FREQ=WEEKLY;INTERVAL=2",
  monthly: "FREQ=MONTHLY",
  yearly: "FREQ=YEARLY",
};

/** Backslash, semicolon, comma and line breaks are escaped in text values. */
export function escapeText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
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
const nextDay = (iso: string) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};
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
  goingName,
  host,
  now = new Date(),
}: {
  name: string;
  events: CareEvent[];
  reminders: FeedReminder[];
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
