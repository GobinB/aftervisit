"use client";

import { batchPages, mergeDrafts } from "@/lib/extract/merge";
import { pageForKeeping } from "@/lib/page-image";
import type { HandoffDraft } from "@/lib/schema";

/** Vercel turns away request bodies over 4.5 MB; a part stays well under that. */
const PART_BYTES = 3.5 * 1024 * 1024;
/** A little longer than the server's own wait for the model, so the server answers first. */
const PART_TIMEOUT_MS = 70_000;

/**
 * Sends the page photos, made small on this phone, to All Hands Care's server, which has them read
 * by the model and drops them. A long summary goes in parts. Resolves to null when anything goes
 * wrong, so the caller reads the photos on the phone instead; the caregiver never sees the error.
 */
export async function readPagesOnServer(files: File[], patientFirstName: string | undefined): Promise<HandoffDraft | null> {
  const pages: Blob[] = [];
  try {
    for (const file of files) pages.push(await pageForKeeping(file));
  } catch {
    return null;
  }
  const drafts: HandoffDraft[] = [];
  for (const part of batchPages(
    pages.map((p) => p.size),
    PART_BYTES,
  )) {
    const form = new FormData();
    for (const i of part) form.append("page", pages[i], `page-${i + 1}.jpg`);
    form.append("firstPage", String(part[0] + 1));
    if (patientFirstName) form.append("patientFirstName", patientFirstName);
    const res = await fetch("/api/extract", { method: "POST", body: form, signal: AbortSignal.timeout(PART_TIMEOUT_MS) }).catch(() => null);
    const data = res?.ok ? ((await res.json().catch(() => null)) as { draft?: HandoffDraft } | null) : null;
    if (!data?.draft) return null;
    drafts.push(data.draft);
  }
  return drafts.length ? mergeDrafts(drafts) : null;
}
