import { readFileSync } from "node:fs";
import { extractText, getDocumentProxy } from "unpdf";
import { expect, test } from "vitest";
import { parse } from "@/lib/parse";

test("text-based PDF (public/sample-avs.pdf) parses like the pasted sample", async () => {
  const pdf = await getDocumentProxy(new Uint8Array(readFileSync("public/sample-avs.pdf")));
  const { text } = await extractText(pdf, { mergePages: false });
  const draft = parse({ text: (text as string[]).join("\n\n") });
  expect(draft.medications.map((m) => [m.name, m.kind])).toEqual([
    ["Lisinopril", "dose_changed"],
    ["Meclizine", "stopped"],
    ["Atorvastatin", "continue"],
  ]);
  expect(draft.watchFor).toHaveLength(4);
  expect(draft.questions).toHaveLength(2);
  expect(draft.tasks.length).toBeGreaterThanOrEqual(5);
  expect(draft.visit.date).toBe("2026-10-03");
  expect(draft.visit.provider).toBe("Dr. Anita Patel");
});
