import { tzlib_get_ical_block } from "timezones-ical-library";

/**
 * Time zones. Times in a circle (a medicine at 7:00, an appointment at 10:30) are wall-clock times
 * where the person lives. The circle keeps that place's time zone (an IANA name such as
 * "America/New_York"), taken from the caregiver's device when it is first known. The server runs in
 * UTC, so "today" and anything sent to a calendar app is worked out in that zone, not the server's.
 */

/** True for an IANA time zone that both the browser's clock and the calendar file can use. */
export function isTimeZone(value: unknown): value is string {
  if (typeof value !== "string" || !value || value.length > 64 || !/^[A-Za-z_]+(\/[A-Za-z0-9_+-]+)*$/.test(value)) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
  } catch {
    return false;
  }
  return vtimezone(value) !== null;
}

/** The calendar file's VTIMEZONE block for a zone, as lines, or null if the zone is not known. */
export function vtimezone(timeZone: string): string[] | null {
  const block = tzlib_get_ical_block(timeZone)?.[0];
  if (!block || !block.startsWith("BEGIN:VTIMEZONE")) return null;
  return block.split(/\r?\n/).filter(Boolean);
}

/** "2026-11-15": the date it is now where the circle is. Without a zone, the UTC date. */
export function todayIn(timeZone: string | null | undefined, now = new Date()): string {
  if (!timeZone) return now.toISOString().slice(0, 10);
  try {
    // en-CA writes dates as YYYY-MM-DD.
    return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

/** Minutes the zone is ahead of UTC at that instant (New York in winter: -300). */
function offsetMinutes(timeZone: string, at: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
  }).formatToParts(at);
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((asUtc - at.getTime()) / 60_000);
}

/** The instant a wall-clock time ("2026-11-15", "23:59:59") happens in a zone. */
export function zonedToUtc(date: string, clock: string, timeZone: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm, ss = 0] = clock.split(":").map(Number);
  const wall = Date.UTC(y, m - 1, d, hh, mm, ss);
  // Two passes settle the offset, including on the days the clocks change.
  let guess = wall - offsetMinutes(timeZone, new Date(wall)) * 60_000;
  guess = wall - offsetMinutes(timeZone, new Date(guess)) * 60_000;
  return new Date(guess);
}
