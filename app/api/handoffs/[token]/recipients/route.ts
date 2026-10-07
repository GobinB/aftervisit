import { env } from "@/lib/env";
import { json, readJson, requireManage } from "@/lib/access";
import { COPY } from "@/lib/copy";
import { db } from "@/lib/db";
import { RATE_LIMITS } from "@/lib/env";
import { hashInvite, logEvent, newInviteToken, normalizeSections } from "@/lib/invites";
import { checkRateLimit } from "@/lib/ratelimit";
import { RecipientShareSchema } from "@/lib/schema";

export const runtime = "nodejs";

/** POST { name, role, sections?, tasksScope? } with x-manage-key: invite one more person. Returns their link once. */
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!(await checkRateLimit(req, "manage", RATE_LIMITS.manage))) return json({ error: "rate_limited", message: COPY.rateLimited }, 429);
  const auth = await requireManage(req, token);
  if ("res" in auth) return auth.res;
  if (auth.row.access_mode !== "invite") return json({ error: "link_mode" }, 400);
  const parsed = RecipientShareSchema.safeParse(await readJson(req));
  if (!parsed.success) return json({ error: "invalid", message: "Add a name and a role." }, 400);

  const invite = newInviteToken();
  const { data, error } = await db()
    .from("handoff_recipients")
    .insert({
      handoff_token: token,
      name: parsed.data.name,
      role: parsed.data.role,
      invite_hash: hashInvite(invite),
      sections: normalizeSections(parsed.data.sections),
      tasks_scope: parsed.data.tasksScope ?? "all",
    })
    .select("id")
    .single();
  if (error) return json({ error: "storage", message: COPY.genericError }, 500);
  const id = (data as { id: string }).id;

  // Steps already assigned to this name now belong to them.
  const lower = parsed.data.name.trim().toLowerCase();
  const ids = auth.row.payload.tasks.filter((t) => t.assignee?.trim().toLowerCase() === lower).map((t) => t.id);
  if (ids.length) await db().from("handoff_task_status").update({ assignee_id: id }).eq("handoff_token", token).is("assignee_id", null).in("task_id", ids);
  await logEvent({ handoff_token: token, recipient_id: id, actor: "creator", via: "creator", kind: "invited", detail: { name: parsed.data.name } });

  const base = process.env.NEXT_PUBLIC_APP_URL ? env.appUrl : new URL(req.url).origin;
  return json({ status: "ok", id, url: `${base}/i/${invite}` }, 201);
}
