import "server-only";
import { z } from "zod";
import { itemId } from "../parse/util";
import { HandoffDraftSchema, MED_KINDS, TASK_CATEGORIES, type HandoffDraft } from "../schema";
import { MED_FIELDS, unreadableFields } from "./flags";
import { heuristicProvider } from "./heuristic";
import type { ExtractInput, ExtractionProvider, PageFile, PagesInput } from "./provider";

/**
 * OpenAI reads the summary: pasted text, page photos or a PDF, through the Responses API with
 * Structured Outputs. Active only when EXTRACTION_PROVIDER=openai and OPENAI_API_KEY are set.
 *
 * Nothing is kept on the way: the request asks OpenAI not to store the response (store: false), and
 * nothing here writes the pages, the text or the answer anywhere. Errors are reported by kind only.
 */

export const DEFAULT_OPENAI_MODEL = "gpt-6.1-terra";
const ENDPOINT = "https://api.openai.com/v1/responses";
/** Under the route's 60 seconds, so a slow answer still leaves time to fall back. */
const TIMEOUT_MS = 50_000;

export const OPENAI_PROMPT = `You read a family caregiver's after-visit summary (clinic visit, hospital discharge,
urgent care, prescription label, lab report or appointment instructions) and sort what it says into a
draft the caregiver will check. Copy only what the document states.

Never guess:
- Never add medical advice, never infer a diagnosis, never invent or complete a medicine, dose, date or
  instruction, and never fill one in from what is usual for that medicine.
- If you cannot read a medicine's name, its dose, or how to take it with certainty (blurred, cut off,
  handwritten and unclear, covered), set that field to null and list it in "unreadable". A null field
  that is simply not stated (a stopped medicine has no dose) is not unreadable.

Fields:
- medications: every new, stopped, dose-changed or explicitly continued medicine. "dose" is the amount
  and strength as written ("20 mg", "1 tablet of 5 mg"). "instructions" is how and when to take it, in
  plain words ("once a day in the morning", not "QAM"). Use "kind" from the document's wording.
- tasks: anything the caregiver or patient must do: schedule, call, pick up, bring, return, go to an
  appointment, get a lab test. One action per task. "dueText" keeps the document's timing words.
  "dueDate" (yyyy-mm-dd) and "dueTime" (24-hour HH:MM) only when the document states that exact date or
  time. Set "unclear" when you could not read part of the task.
- watchFor: symptoms or situations the clinician said to watch for or report. Keep the wording.
- questions: only questions the document itself raises. Empty is fine.
- visit.summary: at most 60 words on why the visit happened and the main outcome. visit.date only if
  stated (yyyy-mm-dd).
- goodToKnow: instructions and advice that are neither a medicine nor something to do once: what to
  avoid, diet, activity limits, how to care for a wound, what is normal to expect. Keep the wording.
  Do not drop instructions. Never put letterhead, addresses, phone numbers, vital signs, page numbers
  or sign-offs here; leave those out.
- sourcePage: the page number the item is on, as labelled before each page ("Page 2"). Null for pasted
  text.
- sourceQuote: the exact sentence or line from the document the item comes from, copied as written.
- If the document is not a medical summary or cannot be read at all, return empty lists and say so in
  visit.summary in one sentence.`;

/** The draft as the model returns it. Every field is required (Structured Outputs, strict). */
export const OpenAiDraftSchema = z.object({
  visit: z.object({
    patientFirstName: z.string().nullable(),
    date: z.string().nullable().describe("yyyy-mm-dd, only if stated"),
    provider: z.string().nullable(),
    specialty: z.string().nullable(),
    clinic: z.string().nullable(),
    reason: z.string().nullable(),
    summary: z.string(),
  }),
  medications: z.array(
    z.object({
      kind: z.enum(MED_KINDS),
      name: z.string().nullable().describe("null if it cannot be read with certainty"),
      dose: z.string().nullable().describe("amount and strength as written; null if not stated or not readable"),
      instructions: z.string().nullable().describe("how and when to take it, in plain words; null if not stated or not readable"),
      reason: z.string().nullable(),
      unreadable: z.array(z.enum(MED_FIELDS)).describe("fields set to null because they could not be read"),
      sourcePage: z.number().int().min(1).max(100).nullable(),
      sourceQuote: z.string().nullable().describe("the exact sentence or line this comes from"),
    }),
  ),
  tasks: z.array(
    z.object({
      title: z.string(),
      category: z.enum(TASK_CATEGORIES),
      dueText: z.string().nullable(),
      dueDate: z.string().nullable().describe("yyyy-mm-dd, only when the exact date is stated"),
      dueTime: z.string().nullable().describe("24-hour HH:MM, only when the exact time is stated"),
      unclear: z.boolean(),
      sourcePage: z.number().int().min(1).max(100).nullable(),
      sourceQuote: z.string().nullable().describe("the exact sentence or line this comes from"),
    }),
  ),
  watchFor: z.array(z.string()),
  questions: z.array(z.string()),
  goodToKnow: z.array(z.string()).describe("instructions that are not a medicine and not a one-time task"),
});
export type OpenAiDraft = z.infer<typeof OpenAiDraftSchema>;

/** The JSON Schema sent to OpenAI (strict mode: every field required, no extra fields). */
export function openAiJsonSchema(): Record<string, unknown> {
  const schema = z.toJSONSchema(OpenAiDraftSchema, { target: "draft-2020-12" }) as Record<string, unknown>;
  delete schema.$schema;
  return schema;
}

/** Why a read did not produce a draft. Kinds only, never content. */
export class ReaderError extends Error {
  constructor(readonly kind: string) {
    super(`reader: ${kind}`);
    this.name = "ReaderError";
  }
}

const orUndef = (v: string | null | undefined, max: number): string | undefined => {
  const t = v?.trim();
  return t ? t.slice(0, max) : undefined;
};
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Turns the model's answer into the app's draft. Unreadable medicine fields stay blank and the item is
 * marked low confidence, which makes the caregiver look at it before the section can be confirmed.
 */
export function toDraft(out: OpenAiDraft, opts: { sourceText?: string; patientFirstName?: string; pages?: [number, number] }): HandoffDraft {
  const page = (n: number | null) => (n !== null && (!opts.pages || (n >= opts.pages[0] && n <= opts.pages[1])) ? n : undefined);
  const medications = out.medications.map((m) => {
    const unreadable = unreadableFields(m);
    const detail = [m.dose, m.instructions].map((s) => s?.trim()).filter(Boolean).join(", ");
    return {
      id: itemId("med"),
      kind: m.kind,
      name: (m.name ?? "").trim().slice(0, 300),
      detail: detail.slice(0, 1000),
      reason: orUndef(m.reason, 300),
      sourceQuote: orUndef(m.sourceQuote, 1000),
      sourcePage: page(m.sourcePage),
      ...(unreadable.length ? { unreadable } : {}),
      confidence: unreadable.length ? ("low" as const) : ("high" as const),
    };
  });
  const tasks = out.tasks
    .filter((t) => t.title.trim())
    .map((t) => {
      const dueDate = t.dueDate && ISO_DATE.test(t.dueDate) ? t.dueDate : undefined;
      return {
        id: itemId("task"),
        title: t.title.trim().slice(0, 1000),
        category: t.category,
        dueText: orUndef(t.dueText, 300),
        ...(dueDate ? { dueDate } : {}),
        ...(dueDate && t.dueTime && TIME.test(t.dueTime) ? { dueTime: t.dueTime } : {}),
        sourceQuote: orUndef(t.sourceQuote, 1000),
        sourcePage: page(t.sourcePage),
        confidence: t.unclear ? ("low" as const) : ("high" as const),
      };
    });
  const list = (xs: string[], max: number) =>
    xs
      .map((x) => x.trim().slice(0, 1000))
      .filter(Boolean)
      .slice(0, max);
  const date = out.visit.date && ISO_DATE.test(out.visit.date) ? out.visit.date : undefined;
  return HandoffDraftSchema.parse({
    visit: {
      patientFirstName: orUndef(opts.patientFirstName, 60) ?? orUndef(out.visit.patientFirstName, 60),
      date,
      provider: orUndef(out.visit.provider, 300),
      specialty: orUndef(out.visit.specialty, 300),
      clinic: orUndef(out.visit.clinic, 300),
      reason: orUndef(out.visit.reason, 1000),
      summary: out.visit.summary.trim().slice(0, 2000),
    },
    medications: medications.slice(0, 100),
    tasks: tasks.slice(0, 100),
    watchFor: list(out.watchFor, 100),
    questions: list(out.questions, 100),
    // The draft keeps its older field name; the screens call this list "Good to know".
    otherNotes: list(out.goodToKnow, 300),
    sourceText: (opts.sourceText ?? quotesByPage(medications, tasks)).slice(0, 100_000),
  });
}

/** Without the document's text (photos), the side panel shows the lines the items came from, by page. */
function quotesByPage(...lists: { sourceQuote?: string; sourcePage?: number }[][]): string {
  const byPage = new Map<number, string[]>();
  for (const item of lists.flat()) {
    if (!item.sourceQuote) continue;
    const key = item.sourcePage ?? 0;
    const lines = byPage.get(key) ?? [];
    if (!lines.includes(item.sourceQuote)) lines.push(item.sourceQuote);
    byPage.set(key, lines);
  }
  return [...byPage.entries()]
    .sort(([a], [b]) => (a || Infinity) - (b || Infinity))
    .map(([pageNo, lines]) => `${pageNo ? `Page ${pageNo}` : "Other pages"}\n${lines.join("\n")}`)
    .join("\n\n");
}

const base64 = (bytes: Uint8Array) => Buffer.from(bytes).toString("base64");

function pageContent(pages: PageFile[], firstPage: number): unknown[] {
  return pages.flatMap((p, i): Record<string, string>[] =>
    p.mime === "application/pdf"
      ? [
          { type: "input_text", text: "The summary is this PDF. Number pages as in the PDF, starting at 1." },
          { type: "input_file", filename: "summary.pdf", file_data: `data:application/pdf;base64,${base64(p.bytes)}` },
        ]
      : [
          { type: "input_text", text: `Page ${firstPage + i}` },
          { type: "input_image", image_url: `data:${p.mime};base64,${base64(p.bytes)}`, detail: "high" },
        ],
  );
}

interface ResponsesBody {
  status?: string;
  output?: { type?: string; content?: { type?: string; text?: string }[] }[];
}

export interface OpenAiReaderOptions {
  apiKey: string;
  model?: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
}

/** One request to /v1/responses. Throws ReaderError on anything but a complete, valid answer. */
export async function callOpenAi(content: unknown[], opts: OpenAiReaderOptions): Promise<OpenAiDraft> {
  const doFetch = opts.fetch ?? fetch;
  let res: Response;
  try {
    res = await doFetch(ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${opts.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: opts.model || DEFAULT_OPENAI_MODEL,
        instructions: OPENAI_PROMPT,
        input: [{ role: "user", content }],
        text: { format: { type: "json_schema", name: "after_visit_draft", schema: openAiJsonSchema(), strict: true } },
        reasoning: { effort: "low" },
        max_output_tokens: 16_000,
        store: false,
      }),
      signal: AbortSignal.timeout(opts.timeoutMs ?? TIMEOUT_MS),
    });
  } catch (e) {
    throw new ReaderError((e as Error).name === "TimeoutError" ? "timeout" : "network");
  }
  if (!res.ok) throw new ReaderError(`http_${res.status}`);
  const body = (await res.json().catch(() => null)) as ResponsesBody | null;
  if (!body || body.status !== "completed") throw new ReaderError(`status_${body?.status ?? "unknown"}`);
  const parts = (body.output ?? []).filter((o) => o.type === "message").flatMap((o) => o.content ?? []);
  if (parts.some((p) => p.type === "refusal")) throw new ReaderError("refusal");
  const text = parts
    .filter((p) => p.type === "output_text")
    .map((p) => p.text ?? "")
    .join("");
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new ReaderError("not_json");
  }
  const parsed = OpenAiDraftSchema.safeParse(json);
  if (!parsed.success) throw new ReaderError("schema");
  return parsed.data;
}

export function createOpenAiProvider(opts: OpenAiReaderOptions): ExtractionProvider {
  return {
    name: "openai",
    async extract(input: ExtractInput) {
      try {
        const out = await callOpenAi([{ type: "input_text", text: `After-visit summary (pasted text):\n\n${input.text}` }], opts);
        return toDraft(out, { sourceText: input.text, patientFirstName: input.patientFirstName });
      } catch (e) {
        // The caregiver never sees a provider error: the built-in parser reads the text instead.
        console.warn("openai reader fell back:", e instanceof ReaderError ? e.kind : "error");
        return heuristicProvider.extract(input);
      }
    },
    async readPages(input: PagesInput) {
      try {
        const firstPage = input.firstPage ?? 1;
        const out = await callOpenAi(pageContent(input.pages, firstPage), opts);
        const isPdf = input.pages.some((p) => p.mime === "application/pdf");
        return toDraft(out, {
          sourceText: input.text,
          patientFirstName: input.patientFirstName,
          pages: isPdf ? undefined : [firstPage, firstPage + input.pages.length - 1],
        });
      } catch (e) {
        console.warn("openai reader fell back:", e instanceof ReaderError ? e.kind : "error");
        return null;
      }
    },
  };
}

export function openaiProvider(): ExtractionProvider {
  return createOpenAiProvider({ apiKey: process.env.OPENAI_API_KEY ?? "", model: process.env.EXTRACTION_MODEL });
}
