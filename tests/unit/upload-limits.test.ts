import { describe, expect, test } from "vitest";
import { MAX_PDF_MB, pdfLimitMb } from "@/lib/upload-limits";

describe("the PDF limit", () => {
  test("4 MB, the same on the phone and the server, under Vercel's 4.5 MB request limit", () => {
    expect(MAX_PDF_MB).toBe(4);
    expect(pdfLimitMb(10)).toBe(4);
  });

  test("never above the general limit", () => {
    expect(pdfLimitMb(3)).toBe(3);
  });
});
