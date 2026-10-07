import "server-only";
import type { HandoffDraft } from "../schema";
import { heuristicProvider } from "./heuristic";

export type ProviderName = "heuristic" | "openai" | "gemini" | "anthropic";

export interface ExtractInput {
  text: string;
  patientFirstName?: string;
}

export interface ExtractionProvider {
  name: ProviderName;
  extract(input: ExtractInput): Promise<HandoffDraft>;
}

function hasKeyFor(p: string): boolean {
  if (p === "anthropic") return !!process.env.ANTHROPIC_API_KEY;
  if (p === "openai") return !!process.env.OPENAI_API_KEY;
  if (p === "gemini") return !!process.env.GEMINI_API_KEY;
  return false;
}

/**
 * The built-in parser is the default and the fallback. An LLM provider activates only
 * when EXTRACTION_PROVIDER names it and its key is set.
 */
export async function getProvider(): Promise<ExtractionProvider> {
  const p = (process.env.EXTRACTION_PROVIDER ?? "heuristic").toLowerCase();
  if (p !== "heuristic" && hasKeyFor(p)) {
    const { llmProvider } = await import("./llm");
    const provider = llmProvider(p as ProviderName);
    if (provider) return provider;
  }
  return heuristicProvider;
}

export function activeProviderName(): ProviderName {
  const p = (process.env.EXTRACTION_PROVIDER ?? "heuristic").toLowerCase();
  return p === "anthropic" && hasKeyFor(p) ? "anthropic" : "heuristic";
}
