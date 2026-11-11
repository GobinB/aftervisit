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

/**
 * Encrypts each page on this device with `seal` (the summary's file key), then sends it. One by one,
 * in order. Only the encrypted bytes leave the device. Calls onPage after each, so the screen can count.
 */
export async function keepPages(
  circleId: string,
  documentId: string,
  files: File[],
  kind: "photos" | "pdf",
  seal: (plain: Uint8Array, page: number) => Promise<Uint8Array>,
  onPage: (done: number) => void,
): Promise<{ ok: true } | { ok: false; error: string }> {
  for (let i = 0; i < files.length; i++) {
    let body: Blob;
    try {
      const plain = kind === "pdf" ? files[i] : await pageForKeeping(files[i]);
      const sealed = await seal(new Uint8Array(await plain.arrayBuffer()), i + 1);
      body = new Blob([sealed.buffer as ArrayBuffer], { type: "application/octet-stream" });
    } catch {
      return { ok: false, error: "A photo could not be prepared on this phone." };
    }
    const response = await fetch(`/api/circles/${circleId}/documents/${documentId}/pages?page=${i + 1}`, {
      method: "POST",
      headers: { "Content-Type": "application/octet-stream" },
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
