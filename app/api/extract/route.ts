import { extractText, getDocumentProxy } from "unpdf";
import { json } from "@/lib/access";
import { COPY } from "@/lib/copy";
import { env, RATE_LIMITS } from "@/lib/env";
import { getProvider } from "@/lib/extract/provider";
import { isUnsorted } from "@/lib/parse";
import { checkRateLimit } from "@/lib/ratelimit";
import { ExtractTextSchema } from "@/lib/schema";

export const runtime = "nodejs";
export const maxDuration = 30;

const SCANNED_PDF_MIN_CHARS = 200;

/**
 * POST /api/extract
 * JSON { text, patientFirstName? } for pasted text and OCR output, or multipart with a
 * PDF in "file". PDFs are read in memory and discarded; nothing here is stored or logged.
 */
export async function POST(req: Request) {
  const maxBytes = env.maxUploadMb * 1024 * 1024;
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > maxBytes + 64 * 1024) return json({ error: "too_large", message: COPY.uploadSize(env.maxUploadMb) }, 413);

  if (!(await checkRateLimit(req, "extract", RATE_LIMITS.extract))) {
    return json({ error: "rate_limited", message: COPY.rateLimited }, 429);
  }

  let text: string;
  let patientFirstName: string | undefined;
  const type = req.headers.get("content-type") ?? "";

  try {
    if (type.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      patientFirstName = (form.get("patientFirstName") as string | null)?.trim() || undefined;
      if (!(file instanceof File)) return json({ error: "no_file", message: COPY.uploadType }, 400);
      if (file.size > maxBytes) return json({ error: "too_large", message: COPY.uploadSize(env.maxUploadMb) }, 413);
      const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
      if (!isPdf) return json({ error: "unsupported_type", message: COPY.uploadType }, 415);
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (!(bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46)) {
        return json({ error: "unsupported_type", message: COPY.uploadType }, 415);
      }
      const pdf = await getDocumentProxy(bytes);
      const out = await extractText(pdf, { mergePages: false });
      text = (Array.isArray(out.text) ? out.text.join("\n\n") : String(out.text)).trim();
      if (text.replace(/\s+/g, "").length < SCANNED_PDF_MIN_CHARS) {
        return json({ error: "scanned_pdf", message: COPY.scannedPdf }, 422);
      }
    } else {
      const body = ExtractTextSchema.safeParse(await req.json().catch(() => null));
      if (!body.success) return json({ error: "invalid", message: "Please paste the text of the summary." }, 400);
      text = body.data.text;
      patientFirstName = body.data.patientFirstName || undefined;
    }

    const provider = await getProvider();
    const draft = await provider.extract({ text, patientFirstName });
    return json({ draft, unsorted: isUnsorted(draft), provider: provider.name });
  } catch (e) {
    // Log the failure class only, never document content or bytes.
    console.error("extract failed:", (e as Error).name);
    return json({ error: "extract_failed", message: "We could not read that file. Try pasting the text or taking a photo instead." }, 422);
  }
}
