import { checkPin, goneResponse, json, pinFailureResponse, readJson } from "@/lib/access";
import { COPY } from "@/lib/copy";
import { RATE_LIMITS } from "@/lib/env";
import { inviteView, lookupInvite, setTaskStatus, taskStatusRows } from "@/lib/invites";
import { checkRateLimit } from "@/lib/ratelimit";
import { TaskUpdateSchema } from "@/lib/schema";

export const runtime = "nodejs";

/**
 * POST { taskId, status, note?, pin? }: a person updates a next step through their own link.
 * Only their own tasks, or unassigned tasks they can see. Recorded as "via personal link".
 */
export async function POST(req: Request, { params }: { params: Promise<{ invite: string }> }) {
  const { invite } = await params;
  if (!(await checkRateLimit(req, "update", RATE_LIMITS.update))) return json({ error: "rate_limited", message: COPY.rateLimited }, 429);
  const found = await lookupInvite(invite);
  if (found.status !== "ok") return goneResponse(found.status);
  const body = await readJson(req);
  const check = await checkPin(found.row, body.pin);
  if (!check.ok) return pinFailureResponse(check);
  const parsed = TaskUpdateSchema.safeParse(body);
  if (!parsed.success) return json({ error: "invalid", message: COPY.genericError }, 400);

  const view = inviteView(found.row, found.recipient, await taskStatusRows(found.row.token));
  if (!view.invite!.canUpdate.includes(parsed.data.taskId)) {
    return json({ error: "forbidden", message: "Only the person this step is assigned to can update it." }, 403);
  }
  const status = await setTaskStatus({
    token: found.row.token,
    taskId: parsed.data.taskId,
    status: parsed.data.status,
    note: parsed.data.note,
    by: { id: found.recipient.id, name: found.recipient.name, via: "personal_link" },
  });
  if (!status) return json({ error: "not_found" }, 404);
  return json({ status: "ok", taskStatus: status });
}
