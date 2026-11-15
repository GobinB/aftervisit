import { describe, expect, test } from "vitest";
import { goodToKnowLines, isGoodToKnow } from "@/lib/extract/good-to-know";
import { heuristicProvider } from "@/lib/extract/heuristic";
import { parse } from "@/lib/parse";

describe("good to know", () => {
  test("keeps instructions that are neither a medicine nor a one-time task", () => {
    for (const line of ["Avoid caffeine after noon.", "Low-salt diet.", "No driving for two weeks.", "You may shower after 48 hours.", "Activity as tolerated."]) {
      expect(isGoodToKnow(line), line).toBe(true);
    }
  });

  test("leaves out letterhead, phone numbers, addresses and sign-offs", () => {
    for (const line of [
      "Riverbend Internal Medicine",
      "1200 Mill Road, Suite 300, Springfield, IL 62704",
      "Questions? Call the clinic at 555-014-2200.",
      "Electronically signed by Anita Patel, MD",
      "Page 2 of 3",
      "Vitals: BP 158/92, pulse 72",
      "Diagnosis:",
    ]) {
      expect(isGoodToKnow(line), line).toBe(false);
    }
  });

  test("drops repeats and keeps the order", () => {
    expect(goodToKnowLines(["Avoid caffeine.", "Riverbend Clinic", "avoid caffeine.", "Low-salt diet."])).toEqual(["Avoid caffeine.", "Low-salt diet."]);
  });

  test("the built-in reader's draft lists only what reads like an instruction", async () => {
    const text = [
      "MAPLEWOOD FAMILY CLINIC",
      "44 Orchard Lane, Maple Falls, OH 44000",
      "Patient: Rose T.   Visit date: 11/04/2026",
      "Medication changes:",
      "- START amlodipine 5 mg once daily.",
      "Other instructions:",
      "Low-salt diet.",
      "Blood pressure today was 150/90.",
    ].join("\n");
    const leftovers = parse({ text }).otherNotes;
    const draft = await heuristicProvider.extract({ text });
    expect(draft.otherNotes.every((line) => leftovers.includes(line))).toBe(true);
    expect(draft.otherNotes.every(isGoodToKnow)).toBe(true);
    expect(draft.otherNotes).not.toContain("44 Orchard Lane, Maple Falls, OH 44000");
  });
});
