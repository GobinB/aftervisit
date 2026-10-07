import { NextResponse } from "next/server";
import { goneResponse, json } from "@/lib/access";
import { lookupInvite } from "@/lib/invites";
import { signedOriginalUrl } from "@/lib/storage";
import { verifyOriginalTicket } from "@/lib/tokens";

export const runtime = "nodejs";

/**
 * GET ?ticket=: re-checks the invitation (not revoked, handoff live, original shared with this
 * person), then redirects to a 60-second signed URL. The ticket proves the PIN was entered.
 */
export async function GET(req: Request, { params }: { params: Promise<{ invite: string }> }) {
  const { invite } = await params;
  const found = await lookupInvite(invite);
  if (found.status !== "ok") return goneResponse(found.status);
  if (!found.row.original_path || !found.recipient.sections.includes("original")) return json({ status: "no_original" }, 404);
  const ticket = new URL(req.url).searchParams.get("ticket");
  if (!verifyOriginalTicket(`invite:${invite}`, ticket)) return json({ status: "pin_required" }, 401);
  const url = await signedOriginalUrl(found.row.original_path);
  if (!url) return json({ status: "unavailable" }, 500);
  return NextResponse.redirect(url, { status: 302, headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
}
