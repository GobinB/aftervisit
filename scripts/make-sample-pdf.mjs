// Renders the Appendix A demo visit (lib/sample.ts) as a one-page PDF: public/sample-avs.pdf
// Usage: node scripts/make-sample-pdf.mjs
import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const src = readFileSync(new URL("../lib/sample.ts", import.meta.url), "utf8");
const text = /SAMPLE_SOURCE_TEXT = `([\s\S]*?)`;/.exec(src)[1];
const [title, ...rest] = text.split("\n");
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

const body = rest
  .join("\n")
  .split(/\n{2,}/)
  .map((block) => `<p>${block.split("\n").map(esc).join("<br>")}</p>`)
  .join("\n");

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  body { font-family: Helvetica, Arial, sans-serif; font-size: 11pt; color: #111; margin: 0; }
  header { border-bottom: 2px solid #333; padding-bottom: 8px; margin-bottom: 16px; }
  h1 { font-size: 15pt; margin: 0; letter-spacing: .02em; }
  .sub { font-size: 9pt; color: #555; margin-top: 2px; }
  p { margin: 0 0 12px; line-height: 1.45; }
  footer { margin-top: 28px; font-size: 8pt; color: #666; border-top: 1px solid #ccc; padding-top: 6px; }
</style></head><body>
<header><h1>${esc(title)}</h1><div class="sub">Fictional sample for AfterVisit demos. Not a real patient.</div></header>
${body}
<footer>Riverbend Internal Medicine · 100 Example Ave · This document is entirely fictional.</footer>
</body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent(html);
await page.pdf({ path: new URL("../public/sample-avs.pdf", import.meta.url).pathname, format: "Letter", margin: { top: "0.7in", bottom: "0.7in", left: "0.8in", right: "0.8in" } });
await browser.close();
console.log("wrote public/sample-avs.pdf");
