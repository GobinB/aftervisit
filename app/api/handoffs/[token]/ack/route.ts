import { checkPin, goneResponse, json, lookup, pinFailureResponse, readJson } from "@/lib/access";
import { COPY } from "@/lib/copy";
import { db } from "@/lib/db";
import { RATE_LIMITS } from "@/lib/env";
import { checkRateLimit } from "@/lib/ratelimit";

export const runtime = "nodejs";

/** POST { name, pin? }: "I've read this". */
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!(await checkRateLimit(req, "ack", RATE_LIMITS.ack))) return json({ error: "rate_limited", message: COPY.rateLimited }, 429);
  const found = await lookup(token);
  if (found.status !== "ok") return goneResponse(found.status);
  const body = await readJson(req);
  const name = typeof body.name === "string" ? body.name.trim().replace(/\s+/g, " ").slice(0, 60) : "";
  if (!name) return json({ error: "name_required", message: "Please add your name so they know who read it." }, 400);
  const check = await checkPin(found.row, body.pin);
  if (!check.ok) return pinFailureResponse(check);
  const { data, error } = await db().rpc("add_ack", { p_token: token, p_name: name });
  if (error || data === null) return json({ error: "ack_failed", message: COPY.genericError }, 500);
  return json({ status: "ok", ackCount: data as number });
}
