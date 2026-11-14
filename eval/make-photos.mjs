// Makes the "photographed" pages of the accuracy set: each page-N.txt is printed onto a sheet of
// paper in a browser, then tilted, lit unevenly, blurred a little and saved as a phone-sized JPEG
// (page-N.jpg). They stand in for phone photos of paper; they are not photos of real documents.
// Usage: node eval/make-photos.mjs
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "@playwright/test";

const dir = join(import.meta.dirname, "cases");
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

// A different look for each case, so the set is not one layout repeated.
const LOOKS = [
  { font: "Helvetica, Arial, sans-serif", size: 21, tilt: -1.6, light: 0.22, blur: 0.5 },
  { font: "Georgia, 'Times New Roman', serif", size: 22, tilt: 1.1, light: 0.3, blur: 0.6 },
  { font: "'Courier New', Courier, monospace", size: 20, tilt: -0.8, light: 0.18, blur: 0.7 },
  { font: "Verdana, sans-serif", size: 19, tilt: 2.0, light: 0.28, blur: 0.5 },
];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 1600 }, deviceScaleFactor: 1 });

for (const [n, id] of readdirSync(dir).sort().entries()) {
  const look = LOOKS[n % LOOKS.length];
  const label = id === "prescription-label";
  for (const file of readdirSync(join(dir, id)).filter((f) => /^page-\d+\.txt$/.test(f))) {
    const text = readFileSync(join(dir, id, file), "utf8").trimEnd();
    // [[blot:50 mg]] is printed, then covered with an ink smear, as if the page got wet.
    const lines = text
      .split("\n")
      .map((l) => (l.trim() ? esc(l).replace(/\[\[blot:(.*?)\]\]/g, '<span class="blot">$1</span>') : "&nbsp;"));
    const html = `<!doctype html><html><head><meta charset="utf-8"><style>
      html, body { margin: 0; width: 1200px; height: 1600px; overflow: hidden; }
      body { background: radial-gradient(circle at 30% 20%, #8a7a66, #5b4d3d 70%); }
      .paper { position: absolute; left: ${label ? 170 : 70}px; top: ${label ? 420 : 50}px; width: ${label ? 860 : 1060}px;
        min-height: ${label ? 560 : 1480}px; box-sizing: border-box; padding: ${label ? "40px 46px" : "64px 70px"};
        background: ${label ? "#fbfaf2" : "#fdfdf8"}; color: #1b1b1b; font-family: ${look.font}; font-size: ${label ? 26 : look.size}px;
        line-height: 1.42; transform: perspective(1800px) rotateX(3deg) rotate(${look.tilt}deg); box-shadow: 0 14px 40px rgba(0,0,0,.45);
        filter: blur(${look.blur}px) contrast(1.05); white-space: pre-wrap; ${label ? "font-weight: 600; letter-spacing: .02em;" : ""} }
      .blot { position: relative; }
      .blot::after { content: ""; position: absolute; left: -10px; right: -12px; top: -6px; bottom: -8px; border-radius: 45% 55% 50% 40%;
        background: radial-gradient(ellipse at 45% 50%, rgba(22,26,52,1) 68%, rgba(22,26,52,.85) 82%, rgba(25,30,60,0) 100%); }
      .shade { position: absolute; inset: 0; pointer-events: none;
        background: linear-gradient(115deg, rgba(255,255,255,.12) 0%, rgba(0,0,0,0) 40%, rgba(0,0,0,${look.light}) 100%); }
    </style></head><body><div class="paper">${lines.map((l) => `<div>${l}</div>`).join("")}</div><div class="shade"></div></body></html>`;
    await page.setContent(html);
    const out = join(dir, id, file.replace(/\.txt$/, ".jpg"));
    await page.screenshot({ path: out, type: "jpeg", quality: 72 });
    console.log("wrote", out);
  }
}
await browser.close();
