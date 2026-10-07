import { env } from "@/lib/env";
import { json, readJson, requireManage } from "@/lib/access";
import { COPY } from "@/lib/copy";
import { addTombstone, db } from "@/lib/db";
import { RATE_LIMITS } from "@/lib/env";
import { hashInvite, logEvent, newInviteToken, type RecipientRow } from "@/lib/invites";
import { checkRateLimit } from "@/lib/ratelimit";

export const runtime = "nodejs";

/**
 * POST { action: "revoke" | "new_link" } with x-manage-key.
 * revoke: that one link stops working; everyone else keeps access.
 * new_link: issues a fresh link for the same person; the old one stops working.
 */
export async function POST(req: Request, { params }: { params: Promise<{ token: string; id: string }> }) {
  const { token, id } = await params;
  if (!(await checkRateLimit(req, "manage", RATE_LIMITS.manage))) return json({ error: "rate_limited", message: COPY.rateLimited }, 429);
  const auth = await requireManage(req, token);
  if ("res" in auth) return auth.res;
  const { action } = await readJson(req);

  const { data } = await db().from("handoff_recipients").select("*").eq("id", id).eq("handoff_token", token).maybeSingle();
  const recipient = data as RecipientRow | null;
  if (!recipient) return json({ error: "not_found" }, 404);

  if (action === "revoke") {
    if (!recipient.revoked_at) {
      await db().from("handoff_recipients").update({ revoked_at: new Date().toISOString() }).eq("id", id);
      await logEvent({ handoff_token: token, recipient_id: id, actor: "creator", via: "creator", kind: "revoked", detail: { name: recipient.name } });
    }
    return json({ status: "ok" });
  }

  if (action === "new_link") {
    const invite = newInviteToken();
    await addTombstone(recipient.invite_hash, "deleted").catch(() => {});
    await db().from("handoff_recipients").update({ invite_hash: hashInvite(invite), revoked_at: null }).eq("id", id);
    await logEvent({ handoff_token: token, recipient_id: id, actor: "creator", via: "creator", kind: "invited", detail: { name: recipient.name, reissued: true } });
    const base = process.env.NEXT_PUBLIC_APP_URL ? env.appUrl : new URL(req.url).origin;
    return json({ status: "ok", url: `${base}/i/${invite}` });
  }

  return json({ error: "invalid" }, 400);
}
