import type { BeforeSend, BeforeSendEvent } from "@vercel/analytics/next";

/** Stand-in for a secret path segment. */
const TOKEN = "[token]";

/**
 * Next segment is a bearer secret:
 * `/i/<invite>`, `/h/<share token>` (including `/manage` and `/manage/view`),
 * and the same values on `/api/invites/<invite>` and `/api/handoffs/<token>`.
 * `/api/handoffs/<token>/recipients/<id>` keeps `<id>`: it is a row uuid, not a key.
 */
const SECRET_SEGMENT = /^\/(?:i|h|api\/invites|api\/handoffs)\/[^/]+/;

/** Fields the insights script may carry beside `url`. 2.0.1 does not pass them into beforeSend; scrub them if it ever does. */
const LOCATION_FIELDS = ["route", "path", "referrer"] as const;

/** Drop the query string and hash, then replace a secret path segment. Null when `input` is not a URL or path. */
export function scrubAnalyticsUrl(input: string): string | null {
  if (input.startsWith("/") && !input.startsWith("//")) {
    const cut = input.search(/[?#]/);
    return scrubPath(cut === -1 ? input : input.slice(0, cut));
  }
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  return `${url.origin}${scrubPath(url.pathname)}`;
}

function scrubPath(pathname: string): string {
  return pathname.replace(SECRET_SEGMENT, (match) => `${match.slice(0, match.lastIndexOf("/") + 1)}${TOKEN}`);
}

/**
 * `beforeSend` for Vercel Web Analytics. Page views and custom events both carry `url`.
 * Returning null drops the event.
 */
export const scrubAnalyticsEvent: BeforeSend = (event) => {
  const url = scrubAnalyticsUrl(event.url);
  if (url === null) return null;
  const next = { ...event, url };
  // 2.0.1's beforeSend event is only `{ type, url }`. These are scrubbed when a script build adds them.
  const extra = next as BeforeSendEvent & Partial<Record<(typeof LOCATION_FIELDS)[number], unknown>>;
  for (const field of LOCATION_FIELDS) {
    const value = extra[field];
    if (typeof value !== "string" || value === "") continue;
    const scrubbed = scrubAnalyticsUrl(value);
    if (scrubbed === null) return null;
    extra[field] = scrubbed;
  }
  return next;
};
