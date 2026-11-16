import "server-only";
import type { HandoffDraft } from "../schema";
import { heuristicProvider } from "./heuristic";

export type ProviderName = "heuristic" | "openai" | "gemini" | "anthropic";

/**
 * Drafts an outside reader handed back from the built-in parser after it failed, so the answer can
 * say which reader really produced the draft (the review page tells the caregiver).
 */
export const fellBack = new WeakSet<object>();

export interface ExtractInput {
  text: string;
  patientFirstName?: string;
}

/** One page photo (already made small on the phone), or a whole PDF. Held in memory only. */
export interface PageFile {
  mime: "image/jpeg" | "image/png" | "image/webp" | "application/pdf";
  bytes: Uint8Array;
}

export interface PagesInput {
  pages: PageFile[];
  patientFirstName?: string;
  /** The number of the first page in this request, when a long summary is sent in parts. */
  firstPage?: number;
  /** The document's own text, when there is one (a PDF made by a computer). Shown on review. */
  text?: string;
}

export interface ExtractionProvider {
  name: ProviderName;
  /** Reads text. Never throws for a provider error: it falls back to the built-in parser. */
  extract(input: ExtractInput): Promise<HandoffDraft>;
  /**
   * Reads page photos or a PDF directly. Resolves to null when it could not (an error, a timeout),
   * so the caller falls back to reading the text on the phone or in the PDF.
   */
  readPages?(input: PagesInput): Promise<HandoffDraft | null>;
}

/** How the active provider is described on the privacy page. */
export interface ProviderDisclosure {
  name: ProviderName;
  /** Whether document text leaves All Hands Care's server to build the draft. */
  thirdParty: boolean;
  /** Whether the page photos (or PDF) themselves are sent to it, not only text read on the phone. */
  readsPages: boolean;
  label: string;
  termsUrl?: string;
}

const DISCLOSURES: Record<ProviderName, ProviderDisclosure> = {
  heuristic: { name: "heuristic", thirdParty: false, readsPages: false, label: "All Hands Care's built-in parser, running on All Hands Care's server" },
  anthropic: {
    name: "anthropic",
    thirdParty: true,
    readsPages: false,
    label: "Anthropic (Claude API)",
    termsUrl: "https://www.anthropic.com/legal/commercial-terms",
  },
  openai: { name: "openai", thirdParty: true, readsPages: true, label: "OpenAI", termsUrl: "https://openai.com/policies/business-terms/" },
  gemini: { name: "gemini", thirdParty: true, readsPages: false, label: "Google Gemini API", termsUrl: "https://ai.google.dev/gemini-api/terms" },
};

/** Providers this codebase can actually call. Others fall back to the built-in parser. */
const IMPLEMENTED: ProviderName[] = ["heuristic", "anthropic", "openai"];

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
