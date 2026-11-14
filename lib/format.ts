/** Date helpers. ISO dates (yyyy-mm-dd) are formatted in UTC so they never shift a day. */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function shortDate(iso?: string | null): string {
  if (!iso) return "";
  const d = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T12:00:00Z`) : new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  // Non-breaking space so "Oct 3" never wraps across lines.
  return `${MONTHS[d.getUTCMonth()]}\u00a0${d.getUTCDate()}`;
}

export function longDate(iso?: string | null): string {
  if (!iso) return "";
  const d = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T12:00:00Z`) : new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

/**
 * "Nov 14, 6:40 AM", in the given time zone (the device's own when left out).
 * Built from parts rather than toLocaleString: Safari writes "Nov 14 at 6:40 AM" and Node
 * "Nov 14, 6:40 AM", and some engines put a narrow space before AM, so the server and the
 * browser would draw different text.
 */
export function dateTime(iso: string, timeZone?: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-US", { month: "numeric", day: "numeric", hour: "numeric", minute: "2-digit", hourCycle: "h23", timeZone }).formatToParts(d);
  const part = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)?.value);
  const hour24 = part("hour") % 24;
  const hour = hour24 % 12 === 0 ? 12 : hour24 % 12;
  const minute = String(part("minute")).padStart(2, "0");
  return `${MONTHS[part("month") - 1]} ${part("day")}, ${hour}:${minute} ${hour24 < 12 ? "AM" : "PM"}`;
}

/** "Dr. Anita Patel" -> "Dr. Patel"; "Maria Chen, NP" -> "Maria Chen, NP". */
export function shortProvider(provider?: string): string {
  if (!provider) return "";
  const m = /^Dr\.?\s+(?:.*\s)?([A-Z][A-Za-z'-]+)$/.exec(provider.trim());
  return m ? `Dr. ${m[1]}` : provider.trim();
}

/** "Margaret's" / "James'" */
export function possessive(name: string): string {
  return /s$/i.test(name) ? `${name}'` : `${name}'s`;
}
