import { checkPin, goneResponse, json, pinFailureResponse, readJson } from "@/lib/access";
import { COPY } from "@/lib/copy";
import { db } from "@/lib/db";
import { RATE_LIMITS } from "@/lib/env";
import { lookupInvite } from "@/lib/invites";
import { checkRateLimit } from "@/lib/ratelimit";

export const runtime = "nodejs";

/** POST { pin? }: "I've read this" through a personal link. Recorded against that invitation. */
export async function POST(req: Request, { params }: { params: Promise<{ invite: string }> }) {
  const { invite } = await params;
  if (!(await checkRateLimit(req, "ack", RATE_LIMITS.ack))) return json({ error: "rate_limited", message: COPY.rateLimited }, 429);
  const found = await lookupInvite(invite);
  if (found.status !== "ok") return goneResponse(found.status);
  const { pin } = await readJson(req);
  const check = await checkPin(found.row, pin);
  if (!check.ok) return pinFailureResponse(check);
  const { error } = await db().rpc("ack_recipient", { p_recipient: found.recipient.id });
  if (error) return json({ error: "ack_failed", message: COPY.genericError }, 500);
  return json({ status: "ok", ackedAt: found.recipient.acked_at ?? new Date().toISOString() });
}
