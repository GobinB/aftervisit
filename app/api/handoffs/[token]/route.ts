import { checkPin, goneResponse, json, lookup, pinFailureResponse, readJson } from "@/lib/access";
import { hardDeleteHandoff, toView } from "@/lib/db";
import { originalLink } from "@/lib/storage";
import { hashManageKey, hashToken, MANAGE_KEY_RE, safeEqual } from "@/lib/tokens";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ token: string }> };

/** GET: the handoff when it has no PIN; otherwise just { hasPin: true }. */
export async function GET(_req: Request, { params }: Ctx) {
  const { token } = await params;
  const found = await lookup(token);
  if (found.status !== "ok") return goneResponse(found.status);
  if (found.row.pin_hash) return json({ status: "pin_required", hasPin: true });
  const originalUrl = found.row.original_path ? originalLink(token) : null;
  return json({ status: "ok", handoff: toView(found.row), originalUrl });
}

/** POST { pin }: PIN verification. The PIN never appears in a URL. */
export async function POST(req: Request, { params }: Ctx) {
  const { token } = await params;
  const found = await lookup(token);
  if (found.status !== "ok") return goneResponse(found.status);
  const { pin } = await readJson(req);
  const check = await checkPin(found.row, pin);
  if (!check.ok) return pinFailureResponse(check);
  const originalUrl = found.row.original_path ? originalLink(token) : null;
  return json({ status: "ok", handoff: toView(found.row), originalUrl });
}

/** DELETE with the manage key in the x-manage-key header: immediate hard delete. */
export async function DELETE(req: Request, { params }: Ctx) {
  const { token } = await params;
  const key = req.headers.get("x-manage-key") ?? "";
  if (!MANAGE_KEY_RE.test(key)) return json({ status: "forbidden" }, 403);
  // The caregiver can delete any handoff they hold the key for, including expired and personal-link ones.
  const found = await lookup(token, { forCreator: true });
  if (found.status !== "ok" && found.status !== "expired") return goneResponse(found.status);
  const { getHandoff } = await import("@/lib/db");
  const row = found.status === "ok" ? found.row : await getHandoff(token);
  if (!row || !safeEqual(hashManageKey(key), row.manage_key_hash)) return json({ status: "forbidden" }, 403);
  await hardDeleteHandoff(row, "deleted", hashToken(token));
  return json({ status: "deleted" });
}
