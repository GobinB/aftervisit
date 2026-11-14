/**
 * The accuracy run for the after-visit summary reader. `npm run eval`.
 *
 * - Built-in parser, on each case's text. Always.
 * - Built-in parser, on the photographed pages read by Tesseract (what happens on the phone). Always;
 *   the first run downloads Tesseract's English data.
 * - OpenAI, on the text and on the photographed pages. Only when OPENAI_API_KEY is set locally.
 *
 * Prints one table per reader and writes them to eval/results.md (not committed).
 */
import { writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test, vi } from "vitest";
import { caseText, loadCases, scoreCase, table, type CaseScore } from "./score";

vi.mock("server-only", () => ({}));

const { parse } = await import("@/lib/parse");
const { createOpenAiProvider } = await import("@/lib/extract/openai");

const cases = loadCases();
const sections: string[] = [];

function report(title: string, rows: { label: string; score: CaseScore }[]) {
  const out = `### ${title}\n\n${table(rows)}\n`;
  sections.push(out);
  console.log(`\n${out}`);
}

test("built-in parser, text", () => {
  report(
    "Built-in parser, on the text",
    cases.map((c) => ({ label: `${c.id} (${c.answers.format})`, score: scoreCase(c.answers, parse({ text: caseText(c) })) })),
  );
});

test("built-in parser, photos read by Tesseract", async () => {
  const { createWorker } = await import("tesseract.js");
  // Tesseract keeps its English data in a cache folder, not in the repo.
  const worker = await createWorker("eng", undefined, { cachePath: join(tmpdir(), "all-hands-care-tesseract") });
  const rows = [];
  for (const c of cases.filter((x) => x.photos.length)) {
    const texts: string[] = [];
    for (const photo of c.photos) texts.push((await worker.recognize(readFileSync(photo))).data.text);
    rows.push({ label: `${c.id} (${c.photos.length} photo${c.photos.length === 1 ? "" : "s"})`, score: scoreCase(c.answers, parse({ text: texts.join("\n\n") })) });
  }
  await worker.terminate();
  report("Built-in parser, on the photos read by Tesseract (as on the phone)", rows);
});

test.runIf(!!process.env.OPENAI_API_KEY)("OpenAI, text and photos", async () => {
  const model = process.env.EXTRACTION_MODEL || undefined;
  const reader = createOpenAiProvider({ apiKey: process.env.OPENAI_API_KEY!, model, timeoutMs: 120_000 });
  const textRows = [];
  const photoRows = [];
  for (const c of cases) {
    textRows.push({ label: `${c.id} (${c.answers.format})`, score: scoreCase(c.answers, await reader.extract({ text: caseText(c) })) });
    if (!c.photos.length) continue;
    const pages = c.photos.map((p) => ({ mime: "image/jpeg" as const, bytes: new Uint8Array(readFileSync(p)) }));
    const draft = await reader.readPages!({ pages });
    if (!draft) throw new Error(`OpenAI could not read ${c.id}; see the warning above`);
    photoRows.push({ label: `${c.id} (${c.photos.length} photo${c.photos.length === 1 ? "" : "s"})`, score: scoreCase(c.answers, draft) });
  }
  report(`OpenAI (${model ?? "gpt-6.1-terra"}), on the text`, textRows);
  report(`OpenAI (${model ?? "gpt-6.1-terra"}), on the photos`, photoRows);
});

test("write eval/results.md", () => {
  const head = `# Accuracy run\n\n${new Date().toISOString().slice(0, 10)}. ${cases.length} fictional cases. "Found" counts right answers; "extra" counts items that were wrong or not in the answers. See eval/README.md.\n\n`;
  writeFileSync(join(import.meta.dirname, "results.md"), head + sections.join("\n"));
});
