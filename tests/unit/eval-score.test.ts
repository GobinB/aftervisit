import { describe, expect, it } from "vitest";
import { compare, loadCases, nameMatches, scoreCase, table, type Answers } from "@/eval/score";
import type { HandoffDraft } from "@/lib/schema";

const answers: Answers = {
  format: "test",
  visitDate: "2026-11-05",
  medications: [
    { name: "amlodipine", kind: "dose_changed", dose: "5 mg" },
    { name: "ibuprofen", kind: "stopped" },
    { name: "metoprolol", kind: "new", unreadableDose: true },
  ],
  nextSteps: [{ what: "Return visit", match: ["return"], date: "2026-12-03" }],
};

function draft(over: Partial<HandoffDraft> = {}): HandoffDraft {
  return {
    visit: { date: "2026-11-05", summary: "" },
    medications: [
      { id: "m1", kind: "dose_changed", name: "Amlodipine", detail: "5 mg once a day", confidence: "high" },
      { id: "m2", kind: "stopped", name: "Ibuprofen 200 mg", detail: "", confidence: "high" },
      { id: "m3", kind: "new", name: "Metoprolol succinate", detail: "once a day", unreadable: ["dose"], confidence: "low" },
    ],
    tasks: [{ id: "t1", title: "Return to clinic", category: "appointment", dueDate: "2026-12-03", confidence: "high" }],
    watchFor: [],
    questions: [],
    otherNotes: [],
    sourceText: "",
    ...over,
  };
}

describe("scoring a case", () => {
  it("gives full marks to a draft with every right answer", () => {
    const s = scoreCase(answers, draft());
    expect(s.medicines).toEqual({ found: 3, expected: 3, extra: 0 });
    expect(s.doses).toEqual({ found: 1, expected: 1, extra: 0 });
    expect(s.dates).toEqual({ found: 2, expected: 2, extra: 0 });
    expect(s.nextSteps).toEqual({ found: 1, expected: 1, extra: 0 });
    expect(s.noGuess).toEqual({ found: 1, expected: 1, extra: 0 });
    expect(s.flagged).toBe(1);
  });

  it("counts a wrong change, a wrong dose, a wrong date and a made-up item", () => {
    const d = draft();
    d.medications[0] = { ...d.medications[0], kind: "continue", detail: "10 mg" };
    d.medications.push({ id: "m4", kind: "new", name: "Warfarin", detail: "", confidence: "high" });
    d.tasks[0] = { ...d.tasks[0], dueDate: "2026-12-04" };
    const s = scoreCase(answers, d);
    expect(s.medicines).toEqual({ found: 2, expected: 3, extra: 2 });
    expect(s.doses).toEqual({ found: 0, expected: 1, extra: 1 });
    expect(s.dates).toEqual({ found: 1, expected: 2, extra: 1 });
  });

  it("counts a guessed dose for an unreadable one", () => {
    const d = draft();
    d.medications[2] = { ...d.medications[2], detail: "50 mg once a day", unreadable: undefined, confidence: "high" };
    expect(scoreCase(answers, d).noGuess).toEqual({ found: 0, expected: 1, extra: 1 });
  });

  it("matches drug names ignoring case, spaces and extra words", () => {
    expect(nameMatches({ name: "potassium chloride", kind: "new" }, "Potassium Chloride ER")).toBe(true);
    expect(nameMatches({ name: "ferrous sulfate", aliases: ["iron"], kind: "stopped" }, "Iron pills")).toBe(true);
    expect(nameMatches({ name: "aspirin", kind: "new" }, "")).toBe(false);
  });

  it("puts readers side by side", () => {
    const s = scoreCase(answers, draft());
    const out = compare([
      { reader: "Built-in parser, text", score: s },
      { reader: "OpenAI, text", score: s },
    ]);
    expect(out.split("\n")[0]).toBe("| | Built-in parser, text | OpenAI, text |");
    expect(out).toContain("| Doses | 1 of 1 (100%) | 1 of 1 (100%) |");
  });

  it("prints a table with a total row", () => {
    const s = scoreCase(answers, draft());
    expect(table([{ label: "a", score: s }])).toContain("| **All cases** | 3 of 3 (100%) | 1 of 1 (100%) | 2 of 2 (100%) | 1 of 1 (100%) | 1 of 1 (100%) | 1 |");
  });
});

describe("the accuracy set", () => {
  const cases = loadCases();

  it("has every format, as text and as photos, all fictional", () => {
    expect(cases.map((c) => c.answers.format)).toEqual(
      expect.arrayContaining(["clinic visit", "hospital discharge", "urgent care", "prescription label", "lab report", "appointment instructions"]),
    );
    for (const c of cases) {
      expect(c.pages.length, c.id).toBeGreaterThan(0);
      expect(c.photos.length, c.id).toBe(c.pages.length);
    }
  });
});
