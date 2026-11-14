import path from "node:path";
import { defineConfig } from "vitest/config";

// The accuracy run (npm run eval). Separate from the unit tests: it can read photos and call OpenAI.
export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "..") } },
  test: { include: ["eval/**/*.eval.ts"], environment: "node", testTimeout: 30 * 60 * 1000, reporters: ["default"] },
});
