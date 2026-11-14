import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const MARKERS = ["SUPABASE_SERVICE_ROLE_KEY", "HELPER_SESSION_SECRET", "CIRCLE_KEY_SECRET", "serviceRoleKey", "helperSessionSecret", "circleKeySecret"];
const SKIP = new Set(["node_modules", ".next", ".git", "tests", "e2e", "coverage", "public"]);

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    if (SKIP.has(name)) return [];
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return files(path);
    return path;
  });
}

describe("secret boundaries", () => {
  test("files that touch secrets start with import \"server-only\"", () => {
    const offenders: string[] = [];
    for (const path of files(".")) {
      if (!/\.(ts|tsx)$/.test(path)) continue;
      if (path.endsWith("middleware.ts")) continue;
      const text = readFileSync(path, "utf8");
      if (!MARKERS.some((marker) => text.includes(marker))) continue;
      if (!text.trimStart().startsWith('import "server-only"')) offenders.push(path);
    }
    expect(offenders).toEqual([]);
  });
});
