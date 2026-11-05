import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

async function dataUrl(file: string): Promise<string> {
  const svg = await readFile(join(process.cwd(), "public/brand", file));
  return `data:image/svg+xml;base64,${svg.toString("base64")}`;
}

/** The white symbol and wordmark as data URLs, for share images drawn with ImageResponse on navy. */
export async function brandOnDark(): Promise<{ symbol: string; wordmark: string }> {
  const [symbol, wordmark] = await Promise.all([dataUrl("symbol-on-dark.svg"), dataUrl("wordmark-on-dark.svg")]);
  return { symbol, wordmark };
}
