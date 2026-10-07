import { NextResponse } from "next/server";
import { checkPin, goneResponse, json, lookup, pinFailureResponse, readJson } from "@/lib/access";
import { originalLink, signedOriginalUrl } from "@/lib/storage";
import { verifyOriginalTicket } from "@/lib/tokens";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ token: string }> };

/**
 * GET: re-checks the handoff, then redirects to a 60-second signed URL.
 * Needs a valid ticket (issued after the PIN check) unless the handoff has no PIN.
 */
export async function GET(req: Request, { params }: Ctx) {
  const { token } = await params;
  const ticket = new URL(req.url).searchParams.get("ticket");
  // A valid ticket was issued by the server after a PIN check or to the caregiver's own view.
  const ticketOk = verifyOriginalTicket(token, ticket);
  const found = await lookup(token, { forCreator: ticketOk });
  if (found.status !== "ok") return goneResponse(found.status);
  if (!found.row.original_path) return json({ status: "no_original" }, 404);
  if (found.row.pin_hash && !ticketOk) return json({ status: "pin_required" }, 401);
  const url = await signedOriginalUrl(found.row.original_path);
  if (!url) return json({ status: "unavailable" }, 500);
  return NextResponse.redirect(url, { status: 302, headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
}

/** POST { pin }: returns { url } (an AfterVisit link with a ticket) after the same PIN check as the handoff. */
export async function POST(req: Request, { params }: Ctx) {
  const { token } = await params;
  const found = await lookup(token);
  if (found.status !== "ok") return goneResponse(found.status);
  if (!found.row.original_path) return json({ status: "no_original" }, 404);
  const { pin } = await readJson(req);
  const check = await checkPin(found.row, pin);
  if (!check.ok) return pinFailureResponse(check);
  return json({ url: originalLink(token) });
}
