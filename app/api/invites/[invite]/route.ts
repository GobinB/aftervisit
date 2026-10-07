import { checkPin, goneResponse, json, pinFailureResponse, readJson } from "@/lib/access";
import { inviteView, lookupInvite, recordOpen, taskStatusRows } from "@/lib/invites";
import { inviteOriginalLink } from "@/lib/storage";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ invite: string }> };

async function view(invite: string, pin: unknown) {
  const found = await lookupInvite(invite);
  if (found.status !== "ok") return goneResponse(found.status);
  const check = await checkPin(found.row, pin);
  if (!check.ok) return pinFailureResponse(check);
  await recordOpen(found.recipient);
  const v = inviteView(found.row, found.recipient, await taskStatusRows(found.row.token));
  return json({ status: "ok", handoff: v, originalUrl: v.hasOriginal ? inviteOriginalLink(invite) : null });
}

/** GET: the person's filtered handoff when there is no PIN; otherwise { status: "pin_required" }. */
export async function GET(_req: Request, { params }: Ctx) {
  const { invite } = await params;
  const found = await lookupInvite(invite);
  if (found.status !== "ok") return goneResponse(found.status);
  if (found.row.pin_hash) return json({ status: "pin_required", hasPin: true });
  return view(invite, undefined);
}

/** POST { pin }: PIN check, then the filtered handoff. */
export async function POST(req: Request, { params }: Ctx) {
  const { invite } = await params;
  const { pin } = await readJson(req);
  return view(invite, pin);
}
