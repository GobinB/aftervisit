import path from "node:path";
import { defineConfig } from "vitest/config";

// The accuracy run (npm run eval), run by hand. Not part of the unit tests or CI.
// OPENAI_API_KEY and EXTRACTION_MODEL can come from the shell or from .env.local (never committed).
try {
  process.loadEnvFile(path.resolve(import.meta.dirname, "../.env.local"));
} catch {
  // No .env.local: only the built-in parser is scored.
}

export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "..") } },
  test: { include: ["eval/**/*.eval.ts"], environment: "node", testTimeout: 30 * 60 * 1000, reporters: ["default"] },
});
