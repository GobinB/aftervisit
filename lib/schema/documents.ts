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
};

export const MAX_DOCUMENT_PAGES = 15;
/** Each page or PDF sent to the server stays under Vercel's 4.5 MB request limit. */
export const MAX_PAGE_BYTES = 4 * 1024 * 1024;

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
