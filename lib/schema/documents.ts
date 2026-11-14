import { z } from "zod";

/** A saved after-visit summary: the photos of its pages, or the PDF, kept with the circle. */
export type VisitDocument = {
  id: string;
  circleId: string;
  visitDate: string | null;
  clinic: string | null;
  kind: "photos" | "pdf";
  pageCount: number;
  saved: number;
  createdAt: string;
  /**
   * The summary's file key, wrapped by the circle key in the caregiver's browser.
   * Null only for a summary saved before pages were encrypted.
   */
  fileKey: StoredDocumentKey | null;
};

export type StoredDocumentKey = { fileKeyWrapped: string; fileKeyIv: string; keyVersion: number };

export const MAX_DOCUMENT_PAGES = 15;
/** Each page or PDF sent to the server stays under Vercel's 4.5 MB request limit. */
export const MAX_PAGE_BYTES = 4 * 1024 * 1024;
/** An encrypted page is its 12-byte IV, the ciphertext, and AES-GCM's 16-byte tag. */
export const SEALED_PAGE_OVERHEAD = 28;
export const MAX_SEALED_PAGE_BYTES = MAX_PAGE_BYTES + SEALED_PAGE_OVERHEAD;

/** A wrapped file key is 32 key bytes plus a 16-byte tag; its IV is 12 bytes. Both base64url. */
const WRAPPED_FILE_KEY = /^[A-Za-z0-9_-]{64}$/;
const FILE_KEY_IV = /^[A-Za-z0-9_-]{16}$/;

export const CreateDocumentSchema = z
  .object({
    circleId: z.string().uuid(),
    visitDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    clinic: z.string().trim().max(300).optional(),
    kind: z.enum(["photos", "pdf"]),
    pageCount: z.number().int().min(1).max(MAX_DOCUMENT_PAGES),
    // Required: a summary is only kept encrypted. The raw file key and the circle key are not fields.
    keyVersion: z.number().int().min(1).max(1000),
    fileKeyWrapped: z.string().regex(WRAPPED_FILE_KEY),
    fileKeyIv: z.string().regex(FILE_KEY_IV),
  })
  .strict();
export type CreateDocumentInput = z.infer<typeof CreateDocumentSchema>;

export const DocumentChangeSchema = z.object({ circleId: z.string().uuid(), id: z.string().uuid() }).strict();

/** JPEG (FF D8 FF) or PDF (%PDF), judged from the file's own first bytes, never its name or stated type. */
export function fileKind(bytes: Uint8Array): "image/jpeg" | "application/pdf" | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) return "application/pdf";
  return null;
}

/** "Nov 4 · Maplewood Family Clinic · 3 pages" */
export function documentTitle(doc: Pick<VisitDocument, "visitDate" | "clinic" | "kind" | "pageCount" | "createdAt">): string {
  const iso = doc.visitDate ?? doc.createdAt.slice(0, 10);
  const date = new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
  const size = doc.kind === "pdf" ? "PDF" : `${doc.pageCount} page${doc.pageCount === 1 ? "" : "s"}`;
  return [date, doc.clinic, size].filter(Boolean).join(" · ");
}
