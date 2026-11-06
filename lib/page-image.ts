"use client";

import { toImageBlob } from "@/lib/ocr";

/**
 * A photo of a page, made small enough to keep: at most 2000 pixels on the long side, as a JPEG.
 * Text stays sharp at that size, and a page is usually 300 to 700 KB instead of several MB.
 * HEIC photos from iPhones are converted first.
 */
export async function pageForKeeping(file: File): Promise<Blob> {
  const source = await toImageBlob(file);
  const bitmap = await createImageBitmap(source);
  const scale = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser cannot prepare the photo.");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
  if (!blob) throw new Error("This browser cannot prepare the photo.");
  return blob;
}

/** Sends the pages one by one, in order. Calls onPage after each, so the screen can count. */
export async function keepPages(
  circleId: string,
  documentId: string,
  files: File[],
  kind: "photos" | "pdf",
  onPage: (done: number) => void,
): Promise<{ ok: true } | { ok: false; error: string }> {
  for (let i = 0; i < files.length; i++) {
    let body: Blob;
    try {
      body = kind === "pdf" ? files[i] : await pageForKeeping(files[i]);
    } catch {
      return { ok: false, error: "A photo could not be prepared on this phone." };
    }
    const response = await fetch(`/api/circles/${circleId}/documents/${documentId}/pages?page=${i + 1}`, {
      method: "POST",
      headers: { "Content-Type": kind === "pdf" ? "application/pdf" : "image/jpeg" },
      body,
    }).catch(() => null);
    if (!response?.ok) {
      const message = (await response?.json().catch(() => null))?.error;
      return { ok: false, error: typeof message === "string" ? message : "The photos could not be kept. Check the connection." };
    }
    onPage(i + 1);
  }
  return { ok: true };
}
