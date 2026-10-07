import { json, readJson, requireManage } from "@/lib/access";
import { COPY } from "@/lib/copy";
import { RATE_LIMITS } from "@/lib/env";
import { setTaskStatus } from "@/lib/invites";
import { checkRateLimit } from "@/lib/ratelimit";
import { TaskUpdateSchema } from "@/lib/schema";

export const runtime = "nodejs";

/** POST { taskId, status, note? } with x-manage-key: the caregiver updates any step. */
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!(await checkRateLimit(req, "manage", RATE_LIMITS.manage))) return json({ error: "rate_limited", message: COPY.rateLimited }, 429);
  const auth = await requireManage(req, token);
  if ("res" in auth) return auth.res;
  const parsed = TaskUpdateSchema.safeParse(await readJson(req));
  if (!parsed.success) return json({ error: "invalid" }, 400);
  const status = await setTaskStatus({
    token,
    ...parsed.data,
    by: { id: null, name: auth.row.created_by || "Caregiver", via: "creator" },
  });
  if (!status) return json({ error: "not_found" }, 404);
  return json({ status: "ok", taskStatus: status });
}
