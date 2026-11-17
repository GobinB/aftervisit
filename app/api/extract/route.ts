import { extractText, getDocumentProxy } from "unpdf";
import { json } from "@/lib/access";
import { getActor } from "@/lib/auth";
import { COPY } from "@/lib/copy";
import { env, RATE_LIMITS } from "@/lib/env";
import { heuristicProvider } from "@/lib/extract/heuristic";
import { fellBack, getProvider, type ExtractionProvider, type PageFile } from "@/lib/extract/provider";
import { isUnsorted } from "@/lib/parse";
import { checkDailyLimit, checkRateLimit } from "@/lib/ratelimit";
import { ExtractTextSchema, type HandoffDraft } from "@/lib/schema";
import { pdfLimitMb } from "@/lib/upload-limits";

export const runtime = "nodejs";
// Reading several page photos with the model can take most of a minute.
export const maxDuration = 60;

const SCANNED_PDF_MIN_CHARS = 200;
const MAX_PAGES_PER_REQUEST = 15;

/** What the bytes are, from their first bytes rather than the name or the declared type. */
function sniff(bytes: Uint8Array): PageFile["mime"] | null {
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) return "application/pdf";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") return "image/webp";
  return null;
}

/**
 * The outside reader (OpenAI) costs money per page, so it reads only for a signed-in caregiver, and
 * at most EXTRACTION_DAILY_LIMIT times a day each (10 by default). Otherwise, the built-in reader.
 * Called only when the outside reader is about to be used, so each call counts one read.
 */
async function readerFor(provider: ExtractionProvider): Promise<ExtractionProvider> {
  if (provider.name === "heuristic") return provider;
  const actor = await getActor();
  if (!actor || actor.kind !== "caregiver") return heuristicProvider;
  return (await checkDailyLimit(actor.userId, "outside_reader", env.extractionDailyLimit)) ? provider : heuristicProvider;
}

/** `provider` is the reader that really made the draft: the built-in parser when the model fell back. */
const ok = (draft: HandoffDraft, provider: string) => json({ draft, unsorted: isUnsorted(draft), provider: fellBack.has(draft) ? "heuristic" : provider });

/**
 * POST /api/extract
 * - JSON { text, patientFirstName?, reader? } for pasted text and text read on the phone.
 * - multipart with a PDF in "file".
 * - multipart with page photos in "page" (in order) and "firstPage", only when the reader reads pages.
 *   If the reader cannot, the answer is { fallback: "read_on_device" } and the phone reads the photos.
 * Pages and text are read in memory and dropped; nothing here is stored or logged.
 */
export async function POST(req: Request) {
  const maxBytes = env.maxUploadMb * 1024 * 1024;
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > maxBytes + 64 * 1024) return json({ error: "too_large", message: COPY.uploadSize(env.maxUploadMb) }, 413);

  if (!(await checkRateLimit(req, "extract", RATE_LIMITS.extract))) {
    return json({ error: "rate_limited", message: COPY.rateLimited }, 429);
  }

  const type = req.headers.get("content-type") ?? "";

  try {
    const configured = await getProvider();

    if (!type.includes("multipart/form-data")) {
      const body = ExtractTextSchema.safeParse(await req.json().catch(() => null));
      if (!body.success) return json({ error: "invalid", message: "Please paste the text of the summary." }, 400);
      const input = { text: body.data.text, patientFirstName: body.data.patientFirstName || undefined };
      // "builtin": the model already could not read these pages, so do not wait for it twice.
      const reader = body.data.reader === "builtin" ? heuristicProvider : await readerFor(configured);
      return ok(await reader.extract(input), reader.name);
    }

    const form = await req.formData();
    const patientFirstName = (form.get("patientFirstName") as string | null)?.trim().slice(0, 60) || undefined;
    const photos = form.getAll("page");

    if (photos.length) {
      if (!configured.readPages) return json({ error: "invalid", message: COPY.genericError }, 400);
      if (photos.length > MAX_PAGES_PER_REQUEST) return json({ error: "too_many", message: COPY.genericError }, 400);
      const firstPage = Math.max(1, Math.min(100, Number(form.get("firstPage")) || 1));
      const pages: PageFile[] = [];
      let total = 0;
      for (const photo of photos) {
        if (!(photo instanceof File)) return json({ error: "no_file", message: COPY.uploadType }, 400);
        total += photo.size;
        if (total > maxBytes) return json({ error: "too_large", message: COPY.uploadSize(env.maxUploadMb) }, 413);
        const bytes = new Uint8Array(await photo.arrayBuffer());
        const mime = sniff(bytes);
        if (!mime || mime === "application/pdf") return json({ error: "unsupported_type", message: COPY.uploadType }, 415);
        pages.push({ mime, bytes });
      }
      // Not signed in, or over today's limit: the phone reads the photos itself.
      const reader = await readerFor(configured);
      const draft = reader.readPages ? await reader.readPages({ pages, patientFirstName, firstPage }) : null;
      return draft ? ok(draft, reader.name) : json({ fallback: "read_on_device" });
    }

    const file = form.get("file");
    if (!(file instanceof File)) return json({ error: "no_file", message: COPY.uploadType }, 400);
    // A PDF has the same 4 MB limit the scan page shows.
    const pdfMb = pdfLimitMb(env.maxUploadMb);
    if (file.size > pdfMb * 1024 * 1024) return json({ error: "too_large", message: COPY.uploadSize(pdfMb) }, 413);
    const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
    if (!isPdf) return json({ error: "unsupported_type", message: COPY.uploadType }, 415);
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (sniff(bytes) !== "application/pdf") return json({ error: "unsupported_type", message: COPY.uploadType }, 415);

    // The PDF's own text, when it has one: shown on review, and what the built-in parser falls back to.
    // Read from a copy, because reading it hands the bytes over to the PDF library.
    const pdf = await getDocumentProxy(bytes.slice());
    const out = await extractText(pdf, { mergePages: false });
    const text = (Array.isArray(out.text) ? out.text.join("\n\n") : String(out.text)).trim();
    const hasText = text.replace(/\s+/g, "").length >= SCANNED_PDF_MIN_CHARS;

    const provider = await readerFor(configured);
    if (provider.readPages) {
      const draft = await provider.readPages({ pages: [{ mime: "application/pdf", bytes }], patientFirstName, text: hasText ? text : undefined });
      if (draft) return ok(draft, provider.name);
    }
    if (!hasText) return json({ error: "scanned_pdf", message: COPY.scannedPdf }, 422);
    // If the model was tried and could not read it, the built-in parser reads the text without a second wait.
    const reader = provider.readPages ? heuristicProvider : provider;
    return ok(await reader.extract({ text, patientFirstName }), reader.name);
  } catch (e) {
    // Log the failure class only, never document content or bytes.
    console.error("extract failed:", (e as Error).name);
    return json({ error: "extract_failed", message: "We could not read that file. Try pasting the text or taking a photo instead." }, 422);
  }
}
