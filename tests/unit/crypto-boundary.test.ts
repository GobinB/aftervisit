import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const SKIP = new Set(["node_modules", ".next", ".git", "tests", "e2e", "coverage", "public"]);

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    if (SKIP.has(name)) return [];
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return files(path);
    return path;
  });
}

describe("crypto stays in the browser", () => {
  test("only client modules import lib/crypto", () => {
    const offenders: string[] = [];
    for (const path of files(".")) {
      if (!/\.(ts|tsx)$/.test(path)) continue;
      if (path.startsWith("lib/crypto/") || path.startsWith("lib\\crypto\\")) continue;
      const text = readFileSync(path, "utf8");
      if (!text.includes("@/lib/crypto")) continue;
      if (!/^\s*["']use client["']/.test(text)) offenders.push(path);
    }
    expect(offenders).toEqual([]);
  });

  test("server actions never place a key fragment on a link", () => {
    const server = ["app/actions/circles.ts", "app/actions/members.ts", "app/actions/enter.ts", "services/circles.ts", "services/members.ts"];
    for (const path of server) {
      const text = readFileSync(path, "utf8");
      expect(text, path).not.toContain("#k=");
      expect(text, path).not.toContain("@/lib/crypto");
    }
  });
});
