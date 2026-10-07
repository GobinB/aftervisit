import "server-only";
import { db } from "./db";

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
    .upload(path, new Uint8Array(await file.arrayBuffer()), { contentType: file.type, upsert: false });
  if (error) throw error;
  return path;
}

/** 1-hour signed URL. */
export async function signedOriginalUrl(path: string): Promise<string | null> {
  const { data, error } = await db().storage.from(ORIGINALS_BUCKET).createSignedUrl(path, 60 * 60);
  if (error) return null;
  return data.signedUrl;
}

export async function deleteOriginal(path: string | null | undefined): Promise<void> {
  if (!path) return;
  const { error } = await db().storage.from(ORIGINALS_BUCKET).remove([path]);
  if (error) throw error;
}
