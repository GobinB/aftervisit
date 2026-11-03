import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { parse, parseWithTrace, isUnsorted } from "@/lib/parse";
import { normalize } from "@/lib/parse/normalize";
import { HandoffDraftSchema } from "@/lib/schema";
import { SAMPLE_SOURCE_TEXT } from "@/lib/sample";

const fixture = (name: string) => readFileSync(`tests/fixtures/${name}`, "utf8");

const meds = (text: string) => parse({ text }).medications.map((m) => [m.name, m.kind]);

interface Expected {
  meds: [string, string][];
  taskCount: number;
  watchCount: number;
  questionCount?: number;
  visit?: Partial<Record<"date" | "provider" | "specialty" | "clinic" | "patientFirstName", string>>;
}

const FIXTURES: Record<string, Expected> = {
  "sample (Appendix A)": {
    meds: [
      ["Lisinopril", "dose_changed"],
      ["Meclizine", "stopped"],
      ["Atorvastatin", "continue"],
    ],
    taskCount: 6,
    watchCount: 4,
    questionCount: 2,
    visit: {
      date: "2026-10-03",
      provider: "Dr. Anita Patel",
      specialty: "Internal Medicine",
      clinic: "Riverbend Internal Medicine",
      patientFirstName: "Margaret",
    },
  },
  "epic-mychart.txt": {
    meds: [
      ["Metformin", "new"],
      ["Glipizide", "dose_changed"],
      ["Glyburide", "stopped"],
      ["Amlodipine", "continue"],
      ["Aspirin", "continue"],
    ],
    taskCount: 3,
    watchCount: 4,
    visit: { date: "2026-10-14", provider: "Dr. James Okafor", clinic: "Lakeside Family Medicine" },
  },
  "cerner.txt": {
    meds: [
      ["Furosemide", "new"],
      ["Metoprolol Succinate", "dose_changed"],
      ["Potassium Chloride", "stopped"],
      ["Lisinopril", "continue"],
    ],
    taskCount: 4,
    watchCount: 3,
    visit: { date: "2026-09-22", provider: "Maria Chen, NP", specialty: "Cardiology", patientFirstName: "Rose" },
  },
  "printed-ocr.txt": {
    meds: [
      ["Amoxicillin", "new"],
      ["Ibuprofen", "stopped"],
      ["Acetaminophen", "continue"],
    ],
    taskCount: 2,
    watchCount: 3,
    questionCount: 1,
    visit: { date: "2026-11-02", provider: "Dr. Lena Ruiz", patientFirstName: "Walter" },
  },
  "urgent-care.txt": {
    meds: [["Ibuprofen", "continue"]],
    taskCount: 3,
    watchCount: 1,
    visit: { date: "2026-08-19", provider: "Paul Grant, PA-C", clinic: "QuickCare Urgent Care" },
  },
  "portal-paste.txt": {
    meds: [
      ["Donepezil", "new"],
      ["Vitamin B12", "continue"],
    ],
    taskCount: 4,
    watchCount: 1,
    questionCount: 2,
    visit: { date: "2026-10-01", provider: "Dr. Sam Lee", specialty: "Neurology" },
  },
};

const textFor = (name: string) => (name.startsWith("sample") ? SAMPLE_SOURCE_TEXT : fixture(name));

describe.each(Object.entries(FIXTURES))("fixture %s", (name, exp) => {
  const text = textFor(name);
  const { draft, trace } = parseWithTrace({ text });

  test("medication names and kinds", () => {
    expect(meds(text)).toEqual(exp.meds);
  });

  test("task, watch-for and question counts", () => {
    expect(draft.tasks).toHaveLength(exp.taskCount);
    expect(draft.watchFor).toHaveLength(exp.watchCount);
    if (exp.questionCount !== undefined) expect(draft.questions).toHaveLength(exp.questionCount);
  });

  test("visit header", () => {
    for (const [k, v] of Object.entries(exp.visit ?? {})) {
      expect(draft.visit[k as keyof typeof draft.visit], k).toBe(v);
    }
  });

  test("output validates against the zod schema", () => {
    expect(HandoffDraftSchema.safeParse(draft).success).toBe(true);
  });

  test("every source line is placed exactly once (nothing lost, nothing invented)", () => {
    expect(trace.buckets).toHaveLength(trace.lines.length);
    // Each normalized line has exactly one bucket.
    for (const b of trace.buckets) expect(b).toBeTruthy();
    // Every line that went to Other notes appears there verbatim.
    trace.lines.forEach((line, i) => {
      if (trace.buckets[i] === "other") expect(draft.otherNotes).toContain(line);
    });
    // Every word of the source survives normalization (no line silently dropped).
    const normWords = trace.lines.join(" ").replace(/[^A-Za-z]/g, "").length;
    const srcWords = text.replace(/[^A-Za-z]/g, "").length;
    expect(normWords).toBeGreaterThanOrEqual(srcWords * 0.98);
  });

  test("every medication and task name appears in the source (no invented items)", () => {
    const lower = text.toLowerCase();
    for (const m of draft.medications) expect(lower).toContain(m.name.toLowerCase().split(" ")[0]);
  });
});

describe("parser details", () => {
  test("sample: inline watch list splits into four items with source wording", () => {
    const d = parse({ text: SAMPLE_SOURCE_TEXT });
    expect(d.watchFor).toEqual([
      "Dizziness gets worse",
      "Any fall",
      "Swelling of the lips or face",
      "Home blood pressure readings below 100/60 or above 180/110",
    ]);
  });

  test("sample: timing phrases become dueText", () => {
    const d = parse({ text: SAMPLE_SOURCE_TEXT });
    const due = d.tasks.map((t) => t.dueText).filter(Boolean);
    expect(due).toEqual(expect.arrayContaining(["within 2 weeks", "in 2 weeks", "in 6 weeks"]));
    expect(d.tasks.find((t) => /metabolic panel/.test(t.title))?.category).toBe("lab");
    expect(d.tasks.find((t) => /physical therapy/i.test(t.title))?.category).toBe("referral");
    expect(d.tasks.find((t) => /return visit/i.test(t.title))?.category).toBe("appointment");
  });

  test("sample: summary comes from the Assessment, capped at 60 words", () => {
    const d = parse({ text: SAMPLE_SOURCE_TEXT });
    expect(d.visit.summary).toMatch(/^Blood pressure remains above goal/);
    expect(d.visit.summary.split(/\s+/).length).toBeLessThanOrEqual(60);
  });

  test("sig abbreviations are expanded", () => {
    const d = parse({ text: "Medications:\nStart cephalexin 500 mg PO BID x 7 days\nTake ondansetron 4 mg q8h PRN nausea\nMelatonin 3 mg QHS" });
    expect(d.medications[0].detail).toContain("by mouth twice a day");
    expect(d.medications[1].detail).toContain("every 8 hours as needed");
    expect(d.medications[2].detail).toContain("at bedtime");
  });

  test("OCR artifacts inside dose numbers are fixed", () => {
    expect(normalize("Start amoxicillin 5O0 mg and l0 mg")[0].text).toBe("Start amoxicillin 500 mg and 10 mg");
  });

  test("lines that wrap mid-sentence are joined", () => {
    const lines = normalize("Check your blood pressure\nevery morning before breakfast.\nBring the log.");
    expect(lines.map((l) => l.text)).toEqual(["Check your blood pressure every morning before breakfast.", "Bring the log."]);
  });

  test("tasks split on ' and ' only when both halves are full instructions", () => {
    const d = parse({ text: "Pick up the new prescription at the pharmacy and call the clinic to book a follow-up in 3 months" });
    expect(d.tasks.map((t) => t.title)).toEqual(["Pick up the new prescription at the pharmacy", "Call the clinic to book a follow-up"]);
    const d2 = parse({ text: "Drink plenty of fluids and rest." });
    expect(d2.tasks).toHaveLength(1);
  });

  test("low confidence when a medication has no verb or no dose", () => {
    const d = parse({ text: "Ibuprofen 400 mg every 6 hours with food as needed." });
    expect(d.medications[0].confidence).toBe("low");
  });

  test("identifier lines never reach the draft", () => {
    const d = parse({ text: "MRN: 123456\nDOB: 01/02/1940\nInsurance: ACME 9981\nStart aspirin 81 mg daily." });
    const all = JSON.stringify(d.medications) + JSON.stringify(d.otherNotes) + JSON.stringify(d.tasks);
    expect(all).not.toMatch(/123456|1940|ACME/);
    expect(d.medications).toHaveLength(1);
  });

  test("unparseable text lands in Other notes, never dropped", () => {
    const text = "Lorem ipsum dolor sit amet.\nConsectetur adipiscing elit.";
    const d = parse({ text });
    expect(isUnsorted(d)).toBe(true);
    expect(d.otherNotes).toEqual(["Lorem ipsum dolor sit amet.", "Consectetur adipiscing elit."]);
  });

  test("intake first name wins over the Patient: field", () => {
    expect(parse({ text: SAMPLE_SOURCE_TEXT, patientFirstName: "maggie" }).visit.patientFirstName).toBe("Maggie");
  });
});

describe("source traceability", () => {
  test("every sample medication and task quotes a sentence that is in the fictional source", async () => {
    const { sampleDraft } = await import("@/lib/sample");
    const flat = SAMPLE_SOURCE_TEXT.replace(/\s+/g, " ");
    const d = sampleDraft();
    for (const item of [...d.medications, ...d.tasks]) {
      expect(item.sourceQuote, item.id).toBeTruthy();
      expect(flat, item.id).toContain(item.sourceQuote!.replace(/\s+/g, " "));
    }
  });

  test("parser attaches the original line to every medication and task", () => {
    for (const name of ["epic-mychart.txt", "cerner.txt", "portal-paste.txt"]) {
      const text = fixture(name);
      const { draft, trace } = parseWithTrace({ text });
      for (const item of [...draft.medications, ...draft.tasks]) {
        expect(item.sourceQuote, `${name}: ${"name" in item ? item.name : item.title}`).toBeTruthy();
        const lines = item.sourceQuote!;
        expect(trace.lines.some((l) => lines.includes(l))).toBe(true);
      }
    }
  });
});
