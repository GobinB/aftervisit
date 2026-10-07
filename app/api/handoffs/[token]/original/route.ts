import { NextResponse } from "next/server";
import { checkPin, goneResponse, json, lookup, pinFailureResponse, readJson } from "@/lib/access";
import { signedOriginalUrl } from "@/lib/storage";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ token: string }> };

async function resolve(token: string, pin: unknown) {
  const found = await lookup(token);
  if (found.status !== "ok") return { res: goneResponse(found.status) };
  if (!found.row.original_path) return { res: json({ status: "no_original" }, 404) };
  const check = await checkPin(found.row, pin);
  if (!check.ok) return { res: pinFailureResponse(check) };
  const url = await signedOriginalUrl(found.row.original_path);
  if (!url) return { res: json({ status: "unavailable" }, 500) };
  return { url };
}

/** GET: redirect to a 1-hour signed URL (handoffs without a PIN only). */
export async function GET(_req: Request, { params }: Ctx) {
  const { token } = await params;
  const r = await resolve(token, undefined);
  if (r.res) return r.res;
  return NextResponse.redirect(r.url!, { status: 302, headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
}

/** POST { pin }: returns { url } after the same PIN check as the handoff. */
export async function POST(req: Request, { params }: Ctx) {
  const { token } = await params;
  const { pin } = await readJson(req);
  const r = await resolve(token, pin);
  if (r.res) return r.res;
  return json({ url: r.url });
}
