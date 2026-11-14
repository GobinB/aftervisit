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
    const server = ["app/actions/circles.ts", "app/actions/circle-keys.ts", "app/actions/members.ts", "app/actions/enter.ts", "services/circles.ts", "services/circle-keys.ts", "services/members.ts"];
    for (const path of server) {
      const text = readFileSync(path, "utf8");
      expect(text, path).not.toContain("#k=");
      expect(text, path).not.toContain("@/lib/crypto");
    }
  });

  test("only the key service opens stored keys, and nothing on the server prints one", () => {
    const importers: string[] = [];
    for (const path of files(".")) {
      if (!/\.(ts|tsx)$/.test(path) || path === "lib/key-custody.ts") continue;
      const text = readFileSync(path, "utf8");
      if (text.includes("@/lib/key-custody")) importers.push(path);
    }
    expect(importers).toEqual(["services/circle-keys.ts"]);
    for (const path of ["lib/key-custody.ts", "services/circle-keys.ts", "app/actions/circle-keys.ts"]) {
      const text = readFileSync(path, "utf8");
      expect(text, path).not.toMatch(/console\.|logger\./);
      expect(text.trimStart().startsWith('import "server-only"') || text.trimStart().startsWith('"use server"'), path).toBe(true);
    }
  });

  test("recovery words are gone from every screen", () => {
    const mentions: string[] = [];
    for (const path of files(".")) {
      if (!/\.tsx$/.test(path)) continue;
      if (/recovery|12 words/i.test(readFileSync(path, "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, ""))) mentions.push(path);
    }
    // Only the privacy page's note on what changed mentions them.
    expect(mentions).toEqual(["app/privacy/page.tsx"]);
  });
});
