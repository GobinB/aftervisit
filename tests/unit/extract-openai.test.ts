import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { batchPages, mergeDrafts } from "@/lib/extract/merge";
import { medNeedsCheck, unreadableFields, unreadableLabel } from "@/lib/extract/flags";
import { createOpenAiProvider, DEFAULT_OPENAI_MODEL, openAiJsonSchema, toDraft, type OpenAiDraft } from "@/lib/extract/openai";
import { providerDisclosure, resolveProviderName } from "@/lib/extract/provider";
import { parse } from "@/lib/parse";
import { SAMPLE_SOURCE_TEXT } from "@/lib/sample";

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);

function answer(overrides: Partial<OpenAiDraft> = {}): OpenAiDraft {
  return {
    visit: { patientFirstName: "Margaret", date: "2026-10-03", provider: "Dr. Anita Patel", specialty: null, clinic: null, reason: "Dizziness", summary: "Blood pressure check." },
    medications: [
      {
        kind: "dose_changed",
        name: "Lisinopril",
        dose: "20 mg",
        instructions: "once a day",
        reason: null,
        unreadable: [],
        sourcePage: 1,
        sourceQuote: "INCREASE lisinopril to 20 mg once daily.",
      },
    ],
    tasks: [
      {
        title: "Get a blood test",
        category: "lab",
        dueText: "in 1 week",
        dueDate: null,
        dueTime: null,
        unclear: false,
        sourcePage: 2,
        sourceQuote: "Blood test in 1 week.",
      },
    ],
    watchFor: ["Fainting"],
    questions: [],
    otherNotes: [],
    ...overrides,
  };
}

function completed(body: unknown) {
  return new Response(
    JSON.stringify({
      id: "resp_1",
      status: "completed",
      output: [
        { type: "reasoning", summary: [] },
        { type: "message", role: "assistant", status: "completed", content: [{ type: "output_text", text: JSON.stringify(body) }] },
      ],
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

function mockFetch(response: Response | (() => Promise<Response>)) {
  return vi.fn<typeof fetch>(async () => (typeof response === "function" ? response() : response.clone()));
}

const sentBody = (f: ReturnType<typeof mockFetch>) => JSON.parse(String(f.mock.calls[0][1]?.body));

let warn: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
});
afterEach(() => {
  warn.mockRestore();
  vi.unstubAllEnvs();
});

describe("OpenAI request", () => {
  it("calls /v1/responses with the default model, strict Structured Outputs and store: false", async () => {
    const f = mockFetch(completed(answer()));
    await createOpenAiProvider({ apiKey: "sk-test", fetch: f }).extract({ text: SAMPLE_SOURCE_TEXT });
    expect(f.mock.calls[0][0]).toBe("https://api.openai.com/v1/responses");
    expect(f.mock.calls[0][1]?.headers).toMatchObject({ Authorization: "Bearer sk-test" });
    const body = sentBody(f);
    expect(body.model).toBe(DEFAULT_OPENAI_MODEL);
    expect(DEFAULT_OPENAI_MODEL).toBe("gpt-6.1-terra");
    expect(body.store).toBe(false);
    expect(body.text.format).toMatchObject({ type: "json_schema", name: "after_visit_draft", strict: true });
    expect(body.instructions).toMatch(/Never guess/);
    expect(body.input[0].content[0]).toEqual({ type: "input_text", text: expect.stringContaining("INCREASE lisinopril") });
  });

  it("uses EXTRACTION_MODEL when set", async () => {
    const f = mockFetch(completed(answer()));
    await createOpenAiProvider({ apiKey: "k", model: "gpt-other", fetch: f }).extract({ text: "x".repeat(60) });
    expect(sentBody(f).model).toBe("gpt-other");
  });

  it("sends each photo as an image input, labelled with its page number", async () => {
    const f = mockFetch(completed(answer()));
    const pages = [
      { mime: "image/jpeg" as const, bytes: JPEG },
      { mime: "image/jpeg" as const, bytes: JPEG },
    ];
    await createOpenAiProvider({ apiKey: "k", fetch: f }).readPages!({ pages, firstPage: 3 });
    const content = sentBody(f).input[0].content;
    expect(content).toEqual([
      { type: "input_text", text: "Page 3" },
      { type: "input_image", image_url: `data:image/jpeg;base64,${Buffer.from(JPEG).toString("base64")}`, detail: "high" },
      { type: "input_text", text: "Page 4" },
      { type: "input_image", image_url: expect.stringMatching(/^data:image\/jpeg;base64,/), detail: "high" },
    ]);
  });

  it("sends a PDF as a file input", async () => {
    const f = mockFetch(completed(answer()));
    const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]);
    await createOpenAiProvider({ apiKey: "k", fetch: f }).readPages!({ pages: [{ mime: "application/pdf", bytes: pdf }] });
    const content = sentBody(f).input[0].content;
    expect(content[1]).toEqual({ type: "input_file", filename: "summary.pdf", file_data: `data:application/pdf;base64,${Buffer.from(pdf).toString("base64")}` });
  });

  it("sends a schema strict mode accepts: every object closed, every field required", () => {
    const walk = (node: unknown, path: string): string[] => {
      if (!node || typeof node !== "object") return [];
      const n = node as Record<string, unknown>;
      const problems: string[] = [];
      if (n.type === "object") {
        const keys = Object.keys((n.properties as object) ?? {});
        if (n.additionalProperties !== false) problems.push(`${path}: additionalProperties`);
        if (JSON.stringify([...((n.required as string[]) ?? [])].sort()) !== JSON.stringify([...keys].sort())) problems.push(`${path}: required`);
      }
      for (const [k, v] of Object.entries(n)) problems.push(...walk(v, `${path}.${k}`));
      return problems;
    };
    const schema = openAiJsonSchema();
    expect(schema.$schema).toBeUndefined();
    expect(walk(schema, "$")).toEqual([]);
    expect(JSON.stringify(schema)).not.toMatch(/allOf|"not"|"if"/);
  });
});

describe("OpenAI answer", () => {
  it("keeps the page and the sentence each item came from", async () => {
    const f = mockFetch(completed(answer()));
    const draft = await createOpenAiProvider({ apiKey: "k", fetch: f }).readPages!({ pages: [{ mime: "image/jpeg", bytes: JPEG }, { mime: "image/jpeg", bytes: JPEG }] });
    expect(draft!.medications[0]).toMatchObject({
      name: "Lisinopril",
      detail: "20 mg, once a day",
      kind: "dose_changed",
      sourcePage: 1,
      sourceQuote: "INCREASE lisinopril to 20 mg once daily.",
      confidence: "high",
    });
    expect(draft!.tasks[0]).toMatchObject({ title: "Get a blood test", sourcePage: 2, sourceQuote: "Blood test in 1 week.", confidence: "high" });
    // Without the document's text, the side panel gets the sentences, by page.
    expect(draft!.sourceText).toBe("Page 1\nINCREASE lisinopril to 20 mg once daily.\n\nPage 2\nBlood test in 1 week.");
  });

  it("drops a page number outside the pages sent", () => {
    const out = answer();
    out.medications[0].sourcePage = 9;
    const draft = toDraft(out, { pages: [1, 2] });
    expect(draft.medications[0].sourcePage).toBeUndefined();
  });

  it("leaves an unreadable name or dose blank and flags the item", () => {
    const out = answer({
      medications: [
        { kind: "new", name: null, dose: "10 mg", instructions: "twice a day", reason: null, unreadable: ["name"], sourcePage: 1, sourceQuote: "S____ 10 mg twice a day" },
        { kind: "new", name: "Metformin", dose: null, instructions: "with breakfast", reason: null, unreadable: ["dose"], sourcePage: 1, sourceQuote: "Metformin ?? mg with breakfast" },
      ],
    });
    const [noName, noDose] = toDraft(out, {}).medications;
    expect(noName).toMatchObject({ name: "", detail: "10 mg, twice a day", unreadable: ["name"], confidence: "low" });
    expect(noDose).toMatchObject({ name: "Metformin", detail: "with breakfast", unreadable: ["dose"], confidence: "low" });
  });

  it("keeps a stated due date and time, and drops malformed ones", () => {
    const out = answer();
    out.tasks = [
      { ...out.tasks[0], dueDate: "2026-11-20", dueTime: "14:30" },
      { ...out.tasks[0], dueDate: "Nov 20", dueTime: "2pm" },
      { ...out.tasks[0], unclear: true },
    ];
    const tasks = toDraft(out, {}).tasks;
    expect(tasks[0]).toMatchObject({ dueDate: "2026-11-20", dueTime: "14:30" });
    expect(tasks[1].dueDate).toBeUndefined();
    expect(tasks[1].dueTime).toBeUndefined();
    expect(tasks[2].confidence).toBe("low");
  });
});

describe("fallback", () => {
  const cases: [string, () => Promise<Response>][] = [
    ["a server error", async () => new Response("{}", { status: 500 })],
    ["a rate limit", async () => new Response("{}", { status: 429 })],
    ["an unfinished answer", async () => new Response(JSON.stringify({ status: "incomplete", incomplete_details: { reason: "max_output_tokens" }, output: [] }))],
    ["a refusal", async () => new Response(JSON.stringify({ status: "completed", output: [{ type: "message", content: [{ type: "refusal", refusal: "no" }] }] }))],
    ["text that is not JSON", async () => new Response(JSON.stringify({ status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: "{oops" }] }] }))],
    ["JSON of the wrong shape", async () => completed({ visit: {} })],
    [
      "a timeout",
      async () => {
        throw new DOMException("The operation timed out.", "TimeoutError");
      },
    ],
    [
      "no network",
      async () => {
        throw new TypeError("fetch failed");
      },
    ],
  ];

  it.each(cases)("photos: %s gives null, so the phone reads them instead", async (_name, respond) => {
    const draft = await createOpenAiProvider({ apiKey: "k", fetch: vi.fn(respond) }).readPages!({ pages: [{ mime: "image/jpeg", bytes: JPEG }] });
    expect(draft).toBeNull();
  });

  it.each(cases)("text: %s gives the built-in parser's draft", async (_name, respond) => {
    const draft = await createOpenAiProvider({ apiKey: "k", fetch: vi.fn(respond) }).extract({ text: SAMPLE_SOURCE_TEXT });
    expect(draft.medications.map((m) => m.name)).toEqual(parse({ text: SAMPLE_SOURCE_TEXT }).medications.map((m) => m.name));
  });

  it("logs only the kind of failure, never the summary", async () => {
    await createOpenAiProvider({ apiKey: "k", fetch: vi.fn(async () => new Response("{}", { status: 503 })) }).extract({ text: SAMPLE_SOURCE_TEXT });
    expect(warn).toHaveBeenCalledWith("openai reader fell back:", "http_503");
    expect(JSON.stringify(warn.mock.calls)).not.toMatch(/lisinopril/i);
  });
});

describe("which reader is on", () => {
  it("is OpenAI only with EXTRACTION_PROVIDER=openai and a key", () => {
    vi.stubEnv("EXTRACTION_PROVIDER", "openai");
    vi.stubEnv("OPENAI_API_KEY", "");
    expect(resolveProviderName()).toBe("heuristic");
    vi.stubEnv("OPENAI_API_KEY", "sk-test");
    expect(resolveProviderName()).toBe("openai");
    expect(providerDisclosure()).toMatchObject({ name: "openai", thirdParty: true, readsPages: true, label: "OpenAI" });
  });

  it("is the built-in parser by default, which does not read pages", () => {
    vi.stubEnv("EXTRACTION_PROVIDER", "");
    expect(providerDisclosure()).toMatchObject({ name: "heuristic", readsPages: false });
  });
});

describe("flagging rule", () => {
  const med = (o: Partial<Parameters<typeof unreadableFields>[0]>) => ({ kind: "new" as const, name: "Aspirin", dose: "81 mg", instructions: "daily", unreadable: [], ...o });

  it("flags what the reader could not read", () => {
    expect(unreadableFields(med({ dose: null, unreadable: ["dose"] }))).toEqual(["dose"]);
    expect(unreadableFields(med({ instructions: null, unreadable: ["instructions"] }))).toEqual(["instructions"]);
  });

  it("always flags a blank name, even if the reader did not say so", () => {
    expect(unreadableFields(med({ name: " " }))).toEqual(["name"]);
  });

  it("flags a medicine to take with neither a dose nor instructions", () => {
    expect(unreadableFields(med({ dose: null, instructions: null }))).toEqual(["dose", "instructions"]);
  });

  it("does not flag a stopped medicine without a dose", () => {
    expect(medNeedsCheck(med({ kind: "stopped", dose: null, instructions: null }))).toBe(false);
  });

  it("does not flag a fully read medicine", () => {
    expect(medNeedsCheck(med({}))).toBe(false);
  });

  it("names the fields in plain words", () => {
    expect(unreadableLabel(["dose"])).toBe("the dose");
    expect(unreadableLabel(["name", "dose", "instructions"])).toBe("the name, the dose and how to take it");
  });
});

describe("a summary sent in parts", () => {
  it("splits pages into parts under the size limit, in order", () => {
    expect(batchPages([1, 1, 1], 10)).toEqual([[0, 1, 2]]);
    expect(batchPages([4, 4, 4, 4], 10)).toEqual([
      [0, 1],
      [2, 3],
    ]);
    expect(batchPages([12, 1], 10)).toEqual([[0], [1]]);
  });

  it("merges the parts into one draft, keeping every item", () => {
    const a = toDraft(answer(), { pages: [1, 2] });
    const b = toDraft(answer({ visit: { ...answer().visit, date: null, specialty: "Cardiology", summary: "More." } }), { pages: [3, 4] });
    const merged = mergeDrafts([a, b]);
    expect(merged.medications).toHaveLength(2);
    expect(merged.tasks).toHaveLength(2);
    expect(merged.watchFor).toEqual(["Fainting"]);
    expect(merged.visit).toMatchObject({ date: "2026-10-03", specialty: "Cardiology", summary: "Blood pressure check. More." });
  });
});
