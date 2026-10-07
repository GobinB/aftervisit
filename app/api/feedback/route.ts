import { z } from "zod";
import { json } from "@/lib/access";
import { COPY } from "@/lib/copy";
import { db } from "@/lib/db";
import { RATE_LIMITS } from "@/lib/env";
import { checkRateLimit } from "@/lib/ratelimit";

export const runtime = "nodejs";

const FeedbackSchema = z.object({
  context: z.enum(["demo", "manage"]),
  easier: z.enum(["yes", "somewhat", "no"]).optional(),
  stillNeed: z.string().trim().max(500).optional(),
  whoElse: z.string().trim().max(500).optional(),
  consent: z.literal(true),
});

/** Anonymous product feedback. No handoff link, no IP address and no patient details are stored with it. */
export async function POST(req: Request) {
  if (!(await checkRateLimit(req, "feedback", RATE_LIMITS.feedback))) return json({ error: "rate_limited", message: COPY.rateLimited }, 429);
  const parsed = FeedbackSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "invalid", message: "Please answer at least one question and agree to share it." }, 400);
  const { context, easier, stillNeed, whoElse } = parsed.data;
  if (!easier && !stillNeed && !whoElse) return json({ error: "empty", message: "Please answer at least one question." }, 400);
  const { error } = await db().from("feedback").insert({ context, easier: easier ?? null, still_need: stillNeed || null, who_else: whoElse || null });
  if (error) return json({ error: "storage", message: COPY.genericError }, 500);
  return json({ status: "ok" }, 201);
}
