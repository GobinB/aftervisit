import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ExtractionProvider } from "@/lib/extract/provider";
import { parse } from "@/lib/parse";
import { SAMPLE_SOURCE_TEXT } from "@/lib/sample";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/ratelimit", () => ({ checkRateLimit: async () => true }));
vi.mock("@/lib/access", () => ({ json: (data: unknown, status = 200) => Response.json(data, { status }) }));

const provider: { current: ExtractionProvider } = { current: null as unknown as ExtractionProvider };
vi.mock("@/lib/extract/provider", () => ({ getProvider: async () => provider.current }));

const { POST } = await import("@/app/api/extract/route");

const modelDraft = { ...parse({ text: SAMPLE_SOURCE_TEXT }), sourceText: "from the model" };

function fakeModel(read: "works" | "fails") {
  const extract = vi.fn(async () => modelDraft);
  const readPages = vi.fn(async () => (read === "works" ? modelDraft : null));
  provider.current = { name: "openai", extract, readPages };
  return { extract, readPages };
}

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]);
const post = (body: FormData | object) =>
  POST(
    new Request("http://localhost/api/extract", {
      method: "POST",
      ...(body instanceof FormData ? { body } : { body: JSON.stringify(body), headers: { "Content-Type": "application/json" } }),
    }),
  );
function photos(n: number, bytes = JPEG) {
  const form = new FormData();
  for (let i = 0; i < n; i++) form.append("page", new Blob([bytes], { type: "image/jpeg" }), `page-${i + 1}.jpg`);
  form.append("firstPage", "1");
  return form;
}
function pdfForm(bytes: Uint8Array) {
  const form = new FormData();
  form.append("file", new Blob([bytes as BlobPart], { type: "application/pdf" }), "summary.pdf");
  return form;
}

beforeEach(() => vi.spyOn(console, "warn").mockImplementation(() => undefined));

describe("POST /api/extract", () => {
  it("sends photos to the model and returns its draft", async () => {
    const { readPages } = fakeModel("works");
    const res = await post(photos(2));
    expect(res.status).toBe(200);
    expect((await res.json()).draft.sourceText).toBe("from the model");
    expect(readPages.mock.calls[0]).toEqual([expect.objectContaining({ firstPage: 1, pages: [expect.objectContaining({ mime: "image/jpeg" }), expect.anything()] })]);
  });

  it("tells the phone to read the photos itself when the model cannot", async () => {
    fakeModel("fails");
    const res = await post(photos(1));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ fallback: "read_on_device" });
  });

  it("turns away photos that are not images", async () => {
    fakeModel("works");
    const res = await post(photos(1, new TextEncoder().encode("hello there")));
    expect(res.status).toBe(415);
  });

  it("does not take photos when the reader cannot read pages", async () => {
    provider.current = { name: "heuristic", extract: vi.fn(async () => modelDraft) };
    expect((await post(photos(1))).status).toBe(400);
  });

  it("text the phone read after the model failed goes to the built-in parser, not the model again", async () => {
    const { extract } = fakeModel("works");
    const res = await post({ text: SAMPLE_SOURCE_TEXT, reader: "builtin" });
    const body = await res.json();
    expect(extract).not.toHaveBeenCalled();
    expect(body.provider).toBe("heuristic");
    expect(body.draft.medications.length).toBeGreaterThan(0);
  });

  it("pasted text goes to the model", async () => {
    const { extract } = fakeModel("works");
    const body = await (await post({ text: SAMPLE_SOURCE_TEXT })).json();
    expect(extract).toHaveBeenCalledOnce();
    expect(body.provider).toBe("openai");
  });

  it("a PDF goes to the model, with its own text for the review screen", async () => {
    const { readPages } = fakeModel("works");
    const res = await post(pdfForm(new Uint8Array(readFileSync("public/sample-avs.pdf"))));
    expect(res.status).toBe(200);
    const input = (readPages.mock.calls[0] as unknown[])[0] as { pages: { mime: string }[]; text?: string };
    expect(input.pages[0].mime).toBe("application/pdf");
    expect(input.text).toMatch(/lisinopril/i);
  });

  it("a PDF the model cannot read falls back to the built-in parser on its text", async () => {
    const { extract } = fakeModel("fails");
    const body = await (await post(pdfForm(new Uint8Array(readFileSync("public/sample-avs.pdf"))))).json();
    expect(extract).not.toHaveBeenCalled();
    expect(body.provider).toBe("heuristic");
    expect(body.draft.medications.map((m: { name: string }) => m.name)).toContain("Lisinopril");
  });
});
