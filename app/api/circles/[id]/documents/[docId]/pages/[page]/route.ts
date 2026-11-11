import { NextResponse } from "next/server";
import { getActor } from "@/lib/auth";
import { readPage } from "@/services/documents";

export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** One saved page, for the circle's caregiver only: still encrypted, for the browser to open. Never cached, never indexed. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string; docId: string; page: string }> }) {
  const { id, docId, page } = await params;
  const n = Number(page);
  const missing = () => new NextResponse("Not found", { status: 404, headers: { "Cache-Control": "private, no-store" } });
  if (!UUID.test(id) || !UUID.test(docId) || !Number.isInteger(n) || n < 1) return missing();
  const actor = await getActor(id);
  if (!actor) return missing();
  const file = await readPage(actor, id, docId, n);
  if (!file) return missing();
  return new NextResponse(file.bytes, {
    headers: {
      "Content-Type": file.type,
      "Content-Disposition": file.sealed ? "attachment" : `inline; filename="visit-summary-page-${n}.${file.type === "application/pdf" ? "pdf" : "jpg"}"`,
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex, nofollow, noarchive",
      "Referrer-Policy": "no-referrer",
    },
  });
}
