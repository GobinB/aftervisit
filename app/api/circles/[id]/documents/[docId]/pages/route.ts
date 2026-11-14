import { NextResponse } from "next/server";
import { getActor } from "@/lib/auth";
import { checkRateLimit } from "@/lib/ratelimit";
import { MAX_SEALED_PAGE_BYTES } from "@/lib/schema/documents";
import { addPage } from "@/services/documents";

export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Keeps one page of a saved visit summary. The page (a JPEG made on the phone, or the PDF) was
 * encrypted in the browser, so the body is ciphertext and is stored as it arrives. ?page=N, in order from 1. Only the circle's caregiver.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string; docId: string }> }) {
  const { id, docId } = await params;
  const page = Number(new URL(request.url).searchParams.get("page"));
  if (!UUID.test(id) || !UUID.test(docId) || !Number.isInteger(page) || page < 1) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (Number(request.headers.get("content-length") ?? 0) > MAX_SEALED_PAGE_BYTES) return NextResponse.json({ error: "too_large" }, { status: 413 });
  if (!(await checkRateLimit(request, "documents", 120))) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  const actor = await getActor(id);
  if (!actor || actor.kind !== "caregiver") return NextResponse.json({ error: "not_found" }, { status: 404 });
  const bytes = new Uint8Array(await request.arrayBuffer());
  const result = await addPage(actor, id, docId, page, bytes);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true });
}
