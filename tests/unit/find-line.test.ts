import { describe, expect, test } from "vitest";
import { findLine, lineTokens, type PageLine } from "@/lib/find-line";

/** A page of lines, top to bottom, each 4% of the page tall. */
const page = (texts: string[]): PageLine[] => texts.map((text, i) => ({ text, x0: 0.1, y0: 0.1 + i * 0.05, x1: 0.9, y1: 0.14 + i * 0.05 }));

const lines = page([
  "RIVERBEND INTERNAL MEDICINE",
  "Medication changes:",
  "- INCREASE lisinopril to 20 mg once daily in the",
  "morning (was 10 mg).",
  "- STOP meclizine 25 mg. Do not take unless instructed.",
  "- CONTINUE atorvastatin 40 mg nightly.",
  "Return visit in 6 weeks with Dr. Patel.",
]);

describe("finding a sentence on a page photo", () => {
  test("marks the line the sentence is on", () => {
    const box = findLine(lines, "STOP meclizine 25 mg. Do not take unless instructed.");
    expect(box).not.toBeNull();
    expect(box!.y).toBeCloseTo(0.3 - 0.0015, 4);
    expect(box!.h).toBeCloseTo(0.04 + 0.003, 4);
    // With no word positions, the line itself is the piece to mark.
    expect(box!.parts).toHaveLength(1);
  });

  test("marks word by word when the words' positions are known, so a sloping line is followed", () => {
    const sloping: PageLine[] = [
      { text: "Limit salt to 2,000 mg a day.", x0: 0.1, y0: 0.5, x1: 0.6, y1: 0.56, words: [
        { x0: 0.1, y0: 0.5, x1: 0.18, y1: 0.52 },
        { x0: 0.2, y0: 0.51, x1: 0.27, y1: 0.53 },
        { x0: 0.29, y0: 0.52, x1: 0.33, y1: 0.54 },
        { x0: 0.35, y0: 0.53, x1: 0.6, y1: 0.56 },
      ] },
    ];
    const mark = findLine(sloping, "Limit salt to 2,000 mg a day.");
    expect(mark!.parts).toHaveLength(4);
    // Each piece is as tall as its word, not as tall as the whole sloping line.
    expect(Math.max(...mark!.parts.map((part) => part.h))).toBeLessThan(0.04);
    expect(mark!.h).toBeGreaterThan(0.06);
  });

  test("marks both lines when the sentence wraps", () => {
    const box = findLine(lines, "INCREASE lisinopril to 20 mg once daily in the morning (was 10 mg).");
    expect(box).not.toBeNull();
    expect(box!.y).toBeCloseTo(0.2 - 0.0015, 4);
    expect(box!.y + box!.h).toBeCloseTo(0.29 + 0.0015, 4);
    expect(box!.parts).toHaveLength(2);
  });

  test("forgives a letter the phone misread in a long word, never a number", () => {
    const misread = page(["- CONTINUE atorvastatln 40 mg nightly.", "- CONTINUE atorvastatin 80 mg nightly."]);
    const box = findLine(misread, "CONTINUE atorvastatin 40 mg nightly.");
    expect(box!.y).toBeCloseTo(0.1 - 0.0015, 4);
  });

  test("marks nothing when the sentence is not on the page", () => {
    expect(findLine(lines, "Start metformin 500 mg twice a day with meals.")).toBeNull();
    expect(findLine([], "STOP meclizine 25 mg.")).toBeNull();
  });

  test("marks nothing for a sentence too short to place", () => {
    expect(findLine(lines, "mg")).toBeNull();
  });

  test("keeps numbers and drops punctuation when comparing words", () => {
    expect(lineTokens("- STOP meclizine 25 mg. (was 12.5 mg)")).toEqual(["stop", "meclizine", "25", "mg", "was", "12.5", "mg"]);
  });
});
