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
    expect(box!.y).toBeCloseTo(0.3 - 0.006, 3);
    expect(box!.h).toBeCloseTo(0.04 + 0.012, 3);
  });

  test("marks both lines when the sentence wraps", () => {
    const box = findLine(lines, "INCREASE lisinopril to 20 mg once daily in the morning (was 10 mg).");
    expect(box).not.toBeNull();
    expect(box!.y).toBeCloseTo(0.2 - 0.006, 3);
    expect(box!.y + box!.h).toBeCloseTo(0.29 + 0.006, 3);
  });

  test("forgives a letter the phone misread in a long word, never a number", () => {
    const misread = page(["- CONTINUE atorvastatln 40 mg nightly.", "- CONTINUE atorvastatin 80 mg nightly."]);
    const box = findLine(misread, "CONTINUE atorvastatin 40 mg nightly.");
    expect(box!.y).toBeCloseTo(0.1 - 0.006, 3);
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
