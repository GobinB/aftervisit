/**
 * The accuracy run: the built-in parser against OpenAI, on the same fictional summaries. `npm run eval`.
 * Run by hand (for a demo, or after changing a reader). Not part of CI.
 *
 * - Built-in parser on each case's text, and on the photos read by Tesseract (as the phone does when
 *   OpenAI is off or cannot answer). The first run downloads Tesseract's English data.
 * - OpenAI on the text and on the photos, when OPENAI_API_KEY is set (in the shell or .env.local),
 *   with EXTRACTION_MODEL if set, the same as the app.
 *
 * Prints a table per reader and a side-by-side summary, and writes them to eval/results.md (not committed).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test, vi } from "vitest";
import { caseText, compare, loadCases, scoreCase, sumScores, table, type CaseScore } from "./score";

vi.mock("server-only", () => ({}));

const { parse } = await import("@/lib/parse");
const { createOpenAiProvider, DEFAULT_OPENAI_MODEL } = await import("@/lib/extract/openai");

const cases = loadCases();
const model = process.env.EXTRACTION_MODEL || DEFAULT_OPENAI_MODEL;
const sections: string[] = [];
const totals: { reader: string; score: CaseScore }[] = [];

function report(reader: string, rows: { label: string; score: CaseScore }[]) {
  const out = `### ${reader}\n\n${table(rows)}\n`;
  sections.push(out);
  totals.push({ reader, score: sumScores(rows.map((r) => r.score)) });
  console.log(`\n${out}`);
}
const label = (id: string, photos?: number) => (photos ? `${id} (${photos} photo${photos === 1 ? "" : "s"})` : id);

test("built-in parser, text", () => {
  report(
    "Built-in parser, text",
    cases.map((c) => ({ label: label(c.id), score: scoreCase(c.answers, parse({ text: caseText(c) })) })),
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
    rows.push({ label: label(c.id, c.photos.length), score: scoreCase(c.answers, parse({ text: texts.join("\n\n") })) });
  }
  await worker.terminate();
  report("Built-in parser, photos", rows);
});

test.runIf(!!process.env.OPENAI_API_KEY)("OpenAI, text and photos", async () => {
  const reader = createOpenAiProvider({ apiKey: process.env.OPENAI_API_KEY!, model, timeoutMs: 120_000 });
  const textRows = [];
  const photoRows = [];
  for (const c of cases) {
    textRows.push({ label: label(c.id), score: scoreCase(c.answers, await reader.extract({ text: caseText(c) })) });
    if (!c.photos.length) continue;
    const pages = c.photos.map((p) => ({ mime: "image/jpeg" as const, bytes: new Uint8Array(readFileSync(p)) }));
    const draft = await reader.readPages!({ pages });
    if (!draft) throw new Error(`OpenAI could not read ${c.id}; see the warning above`);
    photoRows.push({ label: label(c.id, c.photos.length), score: scoreCase(c.answers, draft) });
  }
  report(`OpenAI ${model}, text`, textRows);
  report(`OpenAI ${model}, photos`, photoRows);
});

test("summary and eval/results.md", () => {
  const summary = `### Side by side, all ${cases.length} cases\n\n${compare(totals)}\n`;
  console.log(`\n${summary}${process.env.OPENAI_API_KEY ? "" : "\nOpenAI was not run: set OPENAI_API_KEY in .env.local to include it.\n"}`);
  const head = `# Accuracy run\n\n${new Date().toISOString().slice(0, 10)}. ${cases.length} fictional cases. "Found" counts right answers; "extra" counts items that were wrong or not on the page. See eval/README.md.\n\n`;
  writeFileSync(join(import.meta.dirname, "results.md"), head + summary + "\n" + sections.join("\n"));
});
