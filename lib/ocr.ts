"use client";
/**
 * Client-side OCR with Tesseract.js. Photos never leave the browser; only the
 * recognized text is sent to /api/extract. HEIC photos are converted first.
 */

export interface OcrProgress {
  /** 0..1 across all pages */
  progress: number;
  status: string;
}

async function toImageBlob(file: File): Promise<Blob> {
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
        onProgress({ progress: (page + m.progress) / files.length, status: m.status });
      } else {
        onProgress({ progress: page / files.length, status: m.status });
      }
    },
  });
  try {
    const texts: string[] = [];
    for (page = 0; page < files.length; page++) {
      const img = await toImageBlob(files[page]);
      const { data } = await worker.recognize(img);
      texts.push(data.text);
    }
    onProgress({ progress: 1, status: "done" });
    return texts.join("\n\n");
  } finally {
    await worker.terminate();
  }
}
