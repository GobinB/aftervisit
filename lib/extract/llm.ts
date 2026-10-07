import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { itemId } from "../parse/util";
import { HandoffDraftSchema, MED_KINDS, TASK_CATEGORIES, type HandoffDraft } from "../schema";
import { heuristicProvider } from "./heuristic";
import type { ExtractionProvider, ProviderName } from "./provider";

/**
 * Optional LLM provider (Section 5.4). Not used by the MVP: it activates only when
 * EXTRACTION_PROVIDER=anthropic and ANTHROPIC_API_KEY are both set. Any failure falls
 * back to the built-in parser, so the UI never depends on it.
 */

export const EXTRACTION_PROMPT = `You are helping a family caregiver turn an after-visit summary into a plain-language
care handoff. Extract ONLY what the document states. Never add medical advice,
never infer a diagnosis, never invent a medication, dose, date or instruction.

Rules:
- Write for a family member with no medical training. Short sentences. No abbreviations
  (write "twice a day", not "BID").
- medications: include every new, stopped, dose-changed or explicitly continued medication.
  Put the full instruction in detail. If dose or frequency is unclear, set confidence "low".
- tasks: anything the caregiver or patient must do: schedule, call, pick up, bring, return.
  One action per task. Use the document's timing in dueText.
- watchFor: symptoms or situations the clinician said to watch for or report. Keep the
  source wording.
- questions: only questions the document itself raises (e.g. "discuss at next visit"). Empty is fine.
- visit.summary: at most 60 words on why the visit happened and the main outcome.
- otherNotes: anything else in the document you could not place. Do not drop lines.
- If the document is not an after-visit summary or is unreadable, return empty arrays and set
  visit.summary to a one-sentence explanation.`;

// A flat schema for the model; ids and sourceText are added afterwards.
const LlmDraftSchema = z.object({
  visit: z.object({
    patientFirstName: z.string().nullable(),
    date: z.string().nullable().describe("ISO yyyy-mm-dd, only if stated"),
    provider: z.string().nullable(),
    specialty: z.string().nullable(),
    clinic: z.string().nullable(),
    reason: z.string().nullable(),
    summary: z.string(),
  }),
  medications: z.array(
    z.object({
      kind: z.enum(MED_KINDS),
      name: z.string(),
      detail: z.string(),
      reason: z.string().nullable(),
      confidence: z.enum(["high", "low"]),
    }),
  ),
  tasks: z.array(
    z.object({
      title: z.string(),
      category: z.enum(TASK_CATEGORIES),
      dueText: z.string().nullable(),
      confidence: z.enum(["high", "low"]),
    }),
  ),
  watchFor: z.array(z.string()),
  questions: z.array(z.string()),
  otherNotes: z.array(z.string()),
});

const orUndef = <T>(v: T | null): T | undefined => (v === null || v === "" ? undefined : v);

function toDraft(out: z.infer<typeof LlmDraftSchema>, text: string, patientFirstName?: string): HandoffDraft {
  const date = out.visit.date && /^\d{4}-\d{2}-\d{2}$/.test(out.visit.date) ? out.visit.date : undefined;
  return HandoffDraftSchema.parse({
    visit: {
      patientFirstName: patientFirstName || orUndef(out.visit.patientFirstName),
      date,
      provider: orUndef(out.visit.provider),
      specialty: orUndef(out.visit.specialty),
      clinic: orUndef(out.visit.clinic),
      reason: orUndef(out.visit.reason),
      summary: out.visit.summary,
    },
    medications: out.medications.map((m) => ({ ...m, id: itemId("med"), reason: orUndef(m.reason) })),
    tasks: out.tasks.map((t) => ({ ...t, id: itemId("task"), dueText: orUndef(t.dueText) })),
    watchFor: out.watchFor.filter(Boolean),
    questions: out.questions.filter(Boolean),
    otherNotes: out.otherNotes.filter(Boolean),
    sourceText: text,
  });
}

function anthropicProvider(): ExtractionProvider {
  const client = new Anthropic();
  return {
    name: "anthropic",
    async extract(input) {
      try {
        const response = await client.messages.parse({
          model: process.env.EXTRACTION_MODEL || "claude-opus-5-5",
          max_tokens: 16000,
          output_config: { effort: "low", format: zodOutputFormat(LlmDraftSchema) },
          system: EXTRACTION_PROMPT,
          messages: [{ role: "user", content: `After-visit summary:\n\n${input.text}` }],
        });
        if (response.stop_reason === "refusal" || !response.parsed_output) throw new Error("no structured output");
        return toDraft(response.parsed_output, input.text, input.patientFirstName);
      } catch {
        // Never surface provider errors; the built-in parser is always available.
        return heuristicProvider.extract(input);
      }
    },
  };
}

export function llmProvider(name: ProviderName): ExtractionProvider | null {
  if (name === "anthropic") return anthropicProvider();
  // openai / gemini can be added here behind the same interface.
  return null;
}
