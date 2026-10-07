import "server-only";
import { db } from "./db";
import { originalTicket } from "./tokens";

/** The original, opened through a personal invitation (checks the invitation on every use). */
export function inviteOriginalLink(invite: string): string {
  return `/api/invites/${invite}/original?ticket=${originalTicket(`invite:${invite}`)}`;
}

/** The link a recipient opens: valid for an hour, checked against the database on every use. */
export function originalLink(token: string): string {
  return `/api/handoffs/${token}/original?ticket=${originalTicket(token)}`;
}

export const ORIGINALS_BUCKET = "originals";

const ALLOWED = new Set(["application/pdf", "image/jpeg", "image/png", "image/heic", "image/heif", "image/webp"]);
export const isAllowedOriginalType = (t: string) => ALLOWED.has(t);

function safeName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "original";
  return base.replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^\.+/, "").slice(0, 80) || "original";
}

/** Stores the caregiver's original at {token}/{filename} in the private bucket. */
export async function uploadOriginal(token: string, file: File): Promise<string> {
  const path = `${token}/${safeName(file.name)}`;
  const { error } = await db()
    .storage.from(ORIGINALS_BUCKET)
    // max-age=0 so the CDN never serves a copy after the handoff is deleted.
    .upload(path, new Uint8Array(await file.arrayBuffer()), { contentType: file.type, upsert: false, cacheControl: "0" });
  if (error) throw error;
  return path;
}

/**
 * Short-lived signed URL, created only after the handoff row is checked. Recipients never
 * get this directly: they get /api/handoffs/[token]/original, which re-checks the row on
 * every open, so a deleted handoff stops serving its original immediately.
 */
export async function signedOriginalUrl(path: string, seconds = 60): Promise<string | null> {
  const { data, error } = await db().storage.from(ORIGINALS_BUCKET).createSignedUrl(path, seconds);
  if (error) return null;
  return data.signedUrl;
}

export async function deleteOriginal(path: string | null | undefined): Promise<void> {
  if (!path) return;
  const { error } = await db().storage.from(ORIGINALS_BUCKET).remove([path]);
  if (error) throw error;
}
