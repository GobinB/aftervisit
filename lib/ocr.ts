"use client";
/**
 * Client-side OCR with Tesseract.js. Photos never leave the browser; only the
 * recognized text is sent to /api/extract. HEIC photos are converted first.
 */
import type { PageLine } from "./find-line";

export interface OcrProgress {
  /** 0..1 across all pages */
  progress: number;
  status: string;
  /** The page being read, from 1. */
  page: number;
}

/** Pages are joined in order with a blank line and a form feed, so the parser can tell where one ends. */
export const PAGE_BREAK = "\n\n\f\n\n";

/**
 * Phone photos are often 4000 pixels or more across. Scaled to about 2200 on the long side and
 * turned grey, Tesseract reads them several times faster and usually more accurately.
 */
async function prepare(blob: Blob): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(blob);
    const scale = Math.min(1, 2200 / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return blob;
    ctx.filter = "grayscale(1) contrast(1.15)";
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    return await new Promise<Blob>((resolve) => canvas.toBlob((out) => resolve(out ?? blob), "image/png"));
  } catch {
    return blob;
  }
}

export async function toImageBlob(file: File): Promise<Blob> {
  const isHeic = /image\/hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name);
  if (!isHeic) return file;
  const heic2any = (await import("heic2any")).default;
  const out = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.9 });
  return Array.isArray(out) ? out[0] : out;
}

export async function ocrImages(files: File[], onProgress: (p: OcrProgress) => void): Promise<string> {
  const { createWorker } = await import("tesseract.js");
  let page = 0;
  const worker = await createWorker("eng", 1, {
    logger: (m: { status: string; progress: number }) => {
      if (m.status === "recognizing text") {
        onProgress({ progress: (page + m.progress) / files.length, status: m.status, page: page + 1 });
      } else {
        onProgress({ progress: page / files.length, status: m.status, page: Math.min(page + 1, files.length) });
      }
    },
  });
  try {
    const texts: string[] = [];
    for (page = 0; page < files.length; page++) {
      const img = await prepare(await toImageBlob(files[page]));
      const { data } = await worker.recognize(img);
      texts.push(data.text);
    }
    onProgress({ progress: 1, status: "done", page: files.length });
    return texts.map((text) => text.trim()).join(PAGE_BREAK);
  } finally {
    await worker.terminate();
  }
}

/**
 * The lines of one page photo with where each sits on the page, read on this device. Used by the
 * review screen to mark the line an item came from (lib/find-line.ts); nothing is sent anywhere.
 * One reader is shared and each photo is read once. Resolves to no lines when the photo cannot be read.
 */
type LineReader = Awaited<ReturnType<typeof import("tesseract.js").createWorker>>;
let lineReader: Promise<LineReader> | null = null;
let lineQueue: Promise<unknown> = Promise.resolve();
const pageLines = new WeakMap<File, Promise<PageLine[]>>();

export function readPageLines(file: File): Promise<PageLine[]> {
  let lines = pageLines.get(file);
  if (!lines) {
    // One page at a time: the reader does one job at once, and a phone has little to spare.
    lines = lineQueue.then(() => readLines(file)).catch(() => []);
    lineQueue = lines;
    pageLines.set(file, lines);
  }
  return lines;
}

async function readLines(file: File): Promise<PageLine[]> {
  const img = await prepare(await toImageBlob(file));
  const bitmap = await createImageBitmap(img);
  const { width, height } = bitmap;
  bitmap.close();
  if (!width || !height) return [];
  lineReader ??= import("tesseract.js").then(({ createWorker }) => createWorker("eng"));
  const worker = await lineReader;
  const { data } = await worker.recognize(img, {}, { text: false, blocks: true });
  const lines: PageLine[] = [];
  for (const block of data.blocks ?? []) {
    for (const paragraph of block.paragraphs) {
      for (const line of paragraph.lines) {
        const text = line.text.trim();
        if (!text) continue;
        lines.push({ text, x0: line.bbox.x0 / width, y0: line.bbox.y0 / height, x1: line.bbox.x1 / width, y1: line.bbox.y1 / height });
      }
    }
  }
  return lines;
}

/** Lets go of the shared reader when the review screen closes. */
export function stopPageLineReader() {
  const reader = lineReader;
  lineReader = null;
  lineQueue = Promise.resolve();
  void reader?.then((worker) => worker.terminate()).catch(() => undefined);
}
