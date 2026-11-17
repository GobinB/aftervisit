/**
 * A PDF goes to the server in one request, and Vercel turns away request bodies over 4.5 MB, so a PDF
 * is capped at 4 MB on the phone and on the server alike. Photos are sent in parts under that
 * (lib/read-pages.ts), so they keep the general limit (MAX_UPLOAD_MB).
 */
export const MAX_PDF_MB = 4;

/** The PDF limit, never above the general one. */
export function pdfLimitMb(maxUploadMb: number): number {
  return Math.min(maxUploadMb, MAX_PDF_MB);
}
