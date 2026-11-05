import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

/** The white and coral symbol as a data URL, for share images drawn with ImageResponse. */
export async function symbolOnDarkDataUrl(): Promise<string> {
  const svg = await readFile(join(process.cwd(), "public/brand/symbol-on-dark.svg"));
  return `data:image/svg+xml;base64,${svg.toString("base64")}`;
}
