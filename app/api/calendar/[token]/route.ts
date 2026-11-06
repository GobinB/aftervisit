import { checkRateLimit } from "@/lib/ratelimit";
import { feedFile } from "@/services/calendar-feed";

export const runtime = "nodejs";

/**
 * A circle's private calendar, for Google Calendar, Apple Calendar and Outlook to subscribe to.
 * The address is the secret: /api/calendar/{token}.ics. A new link or Turn off ends it at once.
 */
export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const headers = { "Cache-Control": "private, max-age=300", "X-Robots-Tag": "noindex, nofollow, noarchive", "Referrer-Policy": "no-referrer" };
  if (!(await checkRateLimit(request, "calendar-feed", 240))) return new Response("Too many requests", { status: 429, headers });
  const file = await feedFile(token.replace(/\.ics$/i, ""));
  if (!file) return new Response("Not found", { status: 404, headers });
  return new Response(file, {
    headers: { ...headers, "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": 'inline; filename="care-calendar.ics"' },
  });
}
