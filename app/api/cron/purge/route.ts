import { json } from "@/lib/access";
import { db, hardDeleteHandoff } from "@/lib/db";
import { env } from "@/lib/env";
import { hashToken, safeEqual } from "@/lib/tokens";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Daily purge (vercel.json, 03:00 UTC). Vercel Cron sends CRON_SECRET as a bearer token.
 * Deletes each expired row's stored original, then the row. Reads also check expires_at,
 * so an expired link is never served between runs.
 */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  if (!env.cronSecret || !safeEqual(auth, `Bearer ${env.cronSecret}`)) return json({ error: "unauthorized" }, 401);

  const now = new Date().toISOString();
  let purged = 0;
  let failed = 0;
  for (;;) {
    const { data, error } = await db().from("handoffs").select("token, original_path").lt("expires_at", now).limit(200);
    if (error) return json({ error: "query_failed" }, 500);
    if (!data.length) break;
    for (const row of data) {
      try {
        await hardDeleteHandoff(row, "expired", hashToken(row.token));
        purged++;
      } catch {
        failed++;
      }
    }
    if (failed) break;
  }

  const monthAgo = new Date(Date.now() - 30 * 86_400_000).toISOString();
  await db().from("handoff_tombstones").delete().lt("created_at", monthAgo);
  await db().from("rate_limits").delete().lt("window_start", new Date(Date.now() - 86_400_000).toISOString());

  return json({ purged, failed });
}
