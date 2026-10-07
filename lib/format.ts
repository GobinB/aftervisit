/** Date helpers. ISO dates (yyyy-mm-dd) are formatted in UTC so they never shift a day. */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function shortDate(iso?: string | null): string {
  if (!iso) return "";
  const d = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T12:00:00Z`) : new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

export function longDate(iso?: string | null): string {
  if (!iso) return "";
  const d = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T12:00:00Z`) : new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

export function dateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
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
