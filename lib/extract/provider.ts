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

/** How the active provider is described on the privacy page. */
export interface ProviderDisclosure {
  name: ProviderName;
  /** Whether document text leaves AfterVisit's server to build the draft. */
  thirdParty: boolean;
  label: string;
  termsUrl?: string;
}

const DISCLOSURES: Record<ProviderName, ProviderDisclosure> = {
  heuristic: { name: "heuristic", thirdParty: false, label: "AfterVisit's built-in parser, running on AfterVisit's server" },
  anthropic: {
    name: "anthropic",
    thirdParty: true,
    label: "Anthropic (Claude API)",
    termsUrl: "https://www.anthropic.com/legal/commercial-terms",
  },
  openai: { name: "openai", thirdParty: true, label: "OpenAI API", termsUrl: "https://openai.com/policies/business-terms/" },
  gemini: { name: "gemini", thirdParty: true, label: "Google Gemini API", termsUrl: "https://ai.google.dev/gemini-api/terms" },
};

/** Providers this codebase can actually call. Others fall back to the built-in parser. */
const IMPLEMENTED: ProviderName[] = ["heuristic", "anthropic"];

const KEY_ENV: Partial<Record<ProviderName, string>> = {
  anthropic: "ANTHROPIC_API_KEY",
  openai: "OPENAI_API_KEY",
  gemini: "GEMINI_API_KEY",
};

/**
 * The single source of truth for which provider runs. Used both to extract and to
 * describe processing on the privacy page, so the two can never disagree.
 */
export function resolveProviderName(): ProviderName {
  const requested = (process.env.EXTRACTION_PROVIDER ?? "heuristic").trim().toLowerCase() as ProviderName;
  if (!(requested in DISCLOSURES) || requested === "heuristic") return "heuristic";
  const keyVar = KEY_ENV[requested];
  if (!keyVar || !process.env[keyVar]) return "heuristic";
  if (!IMPLEMENTED.includes(requested)) {
    console.warn(`EXTRACTION_PROVIDER=${requested} is not implemented; using the built-in parser.`);
    return "heuristic";
  }
  return requested;
}

export function providerDisclosure(): ProviderDisclosure {
  return DISCLOSURES[resolveProviderName()];
}

/**
 * The built-in parser is the default and the fallback. An LLM provider activates only
 * when EXTRACTION_PROVIDER names an implemented provider and its key is set.
 */
export async function getProvider(): Promise<ExtractionProvider> {
  const name = resolveProviderName();
  if (name !== "heuristic") {
    const { llmProvider } = await import("./llm");
    const provider = llmProvider(name);
    if (provider) return provider;
  }
  return heuristicProvider;
}
