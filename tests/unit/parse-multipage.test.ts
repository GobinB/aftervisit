import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { parse, parseWithTrace } from "@/lib/parse";
import { normalize } from "@/lib/parse/normalize";
import { stripPageFurniture } from "@/lib/parse/pages";
import { HandoffDraftSchema, type HandoffDraft, type Task } from "@/lib/schema";

// Fictional multi-page summaries, as the browser joins OCR'd pages: a blank line and a form feed between pages.
const fixture = (name: string) => readFileSync(`tests/fixtures/${name}`, "utf8");

type MedExpect = [name: string, kind: string, detail?: string];
interface TaskExpect {
  title: string | RegExp;
  category: Task["category"];
  dueText?: string;
  dueDate?: string;
  dueTime?: string;
}

interface Expected {
  meds: MedExpect[];
  tasks: TaskExpect[];
  watch: string[];
  questions?: string[];
  otherNotes?: string[];
  visit: Partial<Record<"date" | "provider" | "specialty" | "clinic" | "patientFirstName" | "reason", string>>;
  summary?: RegExp;
}

const FIXTURES: Record<string, Expected> = {
  "multipage-epic-primary.txt": {
    meds: [
      ["Lisinopril", "new", "10 mg"],
      ["Metformin", "dose_changed", "1,000 mg"],
      ["Hydrochlorothiazide", "stopped", "12.5 mg"],
      ["Atorvastatin", "continue", "20 mg"],
      // The sig line sits at the top of page 3, under the repeated page header.
      ["Aspirin", "continue", "Take 81 mg by mouth daily"],
    ],
    tasks: [
      // One sentence broken across pages 1 and 2, split into its two instructions.
      { title: "Please check your blood pressure at home", category: "home", dueText: "every morning" },
      { title: "Write the numbers down in a notebook", category: "home" },
      { title: /basic metabolic panel/i, category: "lab", dueText: "in 1 week" },
      { title: /diabetic eye exam/, category: "referral", dueText: "within 3 months" },
      {
        title: "Follow-up visit with Dr. Priya Natarajan at Maplewood Family Clinic",
        category: "appointment",
        dueDate: "2026-11-20",
        dueTime: "10:30",
      },
      {
        title: "Cardiology appointment with Dr. Michael Lee at Maplewood Heart Center, Suite 210",
        category: "appointment",
        dueDate: "2026-12-01",
        dueTime: "09:15",
      },
    ],
    watch: [
      "Blood pressure over 180/110",
      "Dizziness or fainting",
      "A headache that will not go away",
      "Call 911 if you have chest pain or trouble breathing",
    ],
    otherNotes: ["Your blood pressure was higher than we would like today."],
    visit: {
      date: "2026-11-04",
      provider: "Dr. Priya Natarajan",
      specialty: "Family Medicine",
      clinic: "Maplewood Family Clinic",
    },
  },
  "multipage-hospital-discharge.txt": {
    meds: [
      ["Amoxicillin-clavulanate", "new", "875-125 mg"],
      ["Benzonatate", "new", "100 mg"],
      ["Furosemide", "dose_changed", "every other day"],
      // The "Reason:" note stays with the medication instead of becoming one.
      ["Lisinopril", "stopped", "kidney function was low"],
      ["Atorvastatin", "continue", "40 mg"],
      ["Metoprolol Tartrate", "continue", "25 mg"],
    ],
    tasks: [
      {
        title: "Follow up with your primary care provider, Dr. Harold Brandt",
        category: "appointment",
        dueText: "within 7 days of discharge",
      },
      {
        title: "Pulmonology appointment with Dr. Aisha Rahman at Cedar Ridge Pulmonary Clinic, 2nd Floor",
        category: "appointment",
        dueDate: "2026-11-16",
        dueTime: "14:00",
      },
      { title: /^Chest X-ray/, category: "lab", dueText: "in 6 weeks" },
      { title: "Blood work (basic metabolic panel) at the hospital lab", category: "lab", dueDate: "2026-11-09" },
      { title: "Walk short distances several times a day", category: "home" },
      { title: /^Drink 6 to 8 glasses of water/, category: "home" },
    ],
    watch: ["Fever over 100.4 F", "Shortness of breath that gets worse", "Coughing up blood", "Confusion or extreme sleepiness"],
    otherNotes: [],
    visit: {
      // Dated by discharge, not admission.
      date: "2026-11-02",
      provider: "Dr. Elena Vasquez",
      specialty: "Hospital Medicine",
      clinic: "Cedar Ridge Community Hospital",
      patientFirstName: "Samuel",
      reason: "Cough, fever and shortness of breath",
    },
    summary: /^Community-acquired pneumonia, improving/,
  },
  "multipage-cardiology.txt": {
    meds: [
      ["Metoprolol Succinate", "dose_changed", "50 mg to 100 mg"],
      ["Apixaban", "new", "5 mg twice a day"],
      ["Aspirin", "stopped", "81 mg"],
      ["Atorvastatin", "continue", "40 mg at bedtime"],
    ],
    tasks: [
      { title: /^Wear the heart monitor for 14 days/, category: "home" },
      { title: /^Check your pulse and blood pressure/, category: "home", dueText: "every morning" },
      { title: "Get blood work (CBC and kidney panel)", category: "lab", dueText: "in 2 weeks" },
      { title: "Avoid ibuprofen and naproxen while taking apixaban", category: "home" },
      // Page 2 continues the Instructions section.
      { title: "Limit alcohol to one drink a day or less", category: "home" },
      {
        title: "Follow up with Dr. Lee to review the monitor results",
        category: "appointment",
        dueText: "on 12/08/2026 at 10:30 AM",
        dueDate: "2026-12-08",
        dueTime: "10:30",
      },
      {
        title: "Nurse visit at Anticoagulation Clinic",
        category: "appointment",
        dueDate: "2026-11-17",
        dueTime: "08:45",
      },
      { title: "Return to clinic for an echocardiogram", category: "appointment", dueText: "in 3 months" },
    ],
    watch: [
      "Call 911 if you have chest pain, fainting, or sudden weakness on one side of the body",
      "Unusual bruising",
      "Blood in your urine or stool",
      "A resting heart rate over 120",
    ],
    questions: ["Is it safe to go back to swimming laps?"],
    otherNotes: [],
    visit: {
      date: "2026-11-03",
      provider: "Dr. Michael Lee",
      specialty: "Cardiology",
      clinic: "Maplewood Heart Center",
      patientFirstName: "Thomas",
    },
    summary: /^Atrial fibrillation with a controlled heart rate\./,
  },
  "multipage-ocr-noisy.txt": {
    meds: [
      ["Naproxen", "new", "250 mg twice a day"],
      ["Amlodipine", "dose_changed", "5 mg to 10 mg"],
      ["Hydrochlorothiazide", "stopped", "25 mg"],
      ["Levothyroxine", "continue", "50 mcg every morning on an empty stomach"],
      ["Vitamin D3", "continue", "1000 IU daily"],
    ],
    tasks: [
      { title: "Apply ice to the knee for 20 minutes three times a day", category: "home" },
      // "sched-" + "ule" across a hard line break.
      { title: "Physical therapy referral sent; the PT office will call you to schedule your first visit", category: "referral" },
      { title: "Get a knee X-ray at the Willow Creek imaging desk before you leave today", category: "lab" },
      { title: "Return to clinic to recheck your blood pressure", category: "appointment", dueText: "in 4 weeks" },
      {
        title: "Appointment with Hannah Brooks, NP",
        category: "appointment",
        dueText: "Nov 13 at 2:15 PM",
        dueDate: "2026-11-13",
        dueTime: "14:15",
      },
    ],
    watch: ["A fever over 101", "A knee that becomes red and hot", "Trouble putting weight on the leg"],
    otherNotes: ["Thank you for choosing Willow Creek."],
    visit: {
      date: "2026-10-30",
      provider: "Hannah Brooks, NP",
      clinic: "Willow Creek Family Practice",
      patientFirstName: "Gloria",
      reason: "Right knee pain and blood pressure check",
    },
  },
};

/** Everything a caregiver would see, without the original text. */
const visible = (d: HandoffDraft) => JSON.stringify({ ...d, sourceText: undefined });

describe.each(Object.entries(FIXTURES))("multi-page fixture %s", (name, exp) => {
  const text = fixture(name);
  const { draft, trace } = parseWithTrace({ text });

  test("is really multi-page", () => {
    expect(text).toContain("\f");
  });

  test("medications: name, kind and dose", () => {
    expect(draft.medications.map((m) => [m.name, m.kind])).toEqual(exp.meds.map(([n, k]) => [n, k]));
    exp.meds.forEach(([, , detail], i) => {
      if (detail) expect(draft.medications[i].detail, draft.medications[i].name).toContain(detail);
    });
  });

  test("tasks: title, category and due date", () => {
    expect(draft.tasks).toHaveLength(exp.tasks.length);
    exp.tasks.forEach((t, i) => {
      const got = draft.tasks[i];
      if (typeof t.title === "string") expect(got.title).toBe(t.title);
      else expect(got.title).toMatch(t.title);
      expect(got.category, got.title).toBe(t.category);
      if (t.dueText) expect(got.dueText, got.title).toBe(t.dueText);
      // dueDate only for explicit calendar dates; relative phrases stay in dueText.
      expect(got.dueDate, got.title).toBe(t.dueDate);
      expect(got.dueTime, got.title).toBe(t.dueTime);
    });
  });

  test("watch-for, questions and other notes", () => {
    expect(draft.watchFor).toEqual(exp.watch);
    if (exp.questions) expect(draft.questions).toEqual(exp.questions);
    if (exp.otherNotes) expect(draft.otherNotes).toEqual(exp.otherNotes);
  });

  test("visit header", () => {
    for (const [k, v] of Object.entries(exp.visit)) {
      expect(draft.visit[k as keyof typeof draft.visit], k).toBe(v);
    }
    if (exp.summary) expect(draft.visit.summary).toMatch(exp.summary);
  });

  test("no page furniture, identifiers or stray table borders reach the draft", () => {
    const out = visible(draft);
    expect(out).not.toMatch(/Page [0-9lIO]+ of \d/i);
    expect(out).not.toMatch(/Printed/i);
    expect(out).not.toMatch(/MRN|DOB/);
    expect(out).not.toContain("|");
  });

  test("only furniture is removed: page stamps, or lines repeated on several pages", () => {
    const { removed } = stripPageFurniture(text);
    expect(removed.length).toBeGreaterThan(0);
    const flat = text.replace(/\s+/g, " ");
    for (const r of removed) {
      const stamp = /^(?:[|•·,-]\s*)?(?:page\s+\w+\s+of\s+\w+|printed\b.*)$/i.test(r);
      const repeated = flat.split(r.replace(/\s+/g, " ")).length - 1 >= 2;
      expect(stamp || repeated, r).toBe(true);
    }
  });

  test("every remaining line is placed exactly once and Other notes keep their wording", () => {
    expect(trace.buckets).toHaveLength(trace.lines.length);
    trace.lines.forEach((line, i) => {
      expect(trace.buckets[i], line).toBeTruthy();
      if (trace.buckets[i] === "other") expect(draft.otherNotes).toContain(line);
    });
  });

  test("every medication and task quotes a line of the source", () => {
    for (const item of [...draft.medications, ...draft.tasks]) {
      expect(item.sourceQuote).toBeTruthy();
      expect(trace.lines.some((l) => item.sourceQuote!.includes(l))).toBe(true);
    }
    const lower = text.toLowerCase();
    for (const m of draft.medications) expect(lower).toContain(m.name.toLowerCase().split(" ")[0]);
  });

  test("output validates against the zod schema", () => {
    expect(HandoffDraftSchema.safeParse(draft).success).toBe(true);
  });
});

describe("page furniture", () => {
  test("single-page text keeps everything except stamps", () => {
    const { text, removed } = stripPageFurniture("Clinic A\nStart aspirin 81 mg daily.\nPage 1 of 1");
    expect(text).toBe("Clinic A\nStart aspirin 81 mg daily.");
    expect(removed).toEqual(["Page 1 of 1"]);
  });

  test("a mention of a page inside a sentence is not furniture", () => {
    expect(stripPageFurniture("See the diet sheet on page 2").text).toBe("See the diet sheet on page 2");
  });

  test("a list split by a page break stays one list in one section", () => {
    const text = [
      "Lakeview Clinic",
      "Medications:",
      "Start aspirin 81 mg daily.",
      "Printed on 11/04/2026 3:14 PM    Page 1 of 2",
      "",
      "\fLakeview Clinic",
      "Continue lisinopril 10 mg daily.",
      "Page 2 of 2",
    ].join("\n");
    const d = parse({ text });
    expect(d.medications.map((m) => m.name)).toEqual(["Aspirin", "Lisinopril"]);
    expect(d.otherNotes).toEqual([]);
    expect(d.visit.clinic).toBe("Lakeview Clinic");
  });

  test("repeated lines in the middle of a page are content, not furniture", () => {
    const page = (n: number) =>
      ["Clinic A", `Section ${n}`, "Drink fluids.", "Walk daily.", "Rest at home.", "Eat well.", "Sleep well.", `Note ${n}.`].join("\n");
    const { text: out } = stripPageFurniture(`${page(1)}\n\n\f${page(2)}`);
    expect(out.split("\n").filter((l) => l === "Rest at home.")).toHaveLength(2);
    expect(out.split("\n").filter((l) => l === "Clinic A")).toHaveLength(1);
  });
});

describe("OCR clean-up", () => {
  const norm = (s: string) => normalize(s).map((l) => l.text);

  test("dose units and digits are fixed only next to a number", () => {
    expect(norm("Take lisinopril 10 rng daily")).toEqual(["Take lisinopril 10 mg daily"]);
    expect(norm("Start amlodipine l0 mg and metoprolol 1O mg")).toEqual(["Start amlodipine 10 mg and metoprolol 10 mg"]);
    expect(norm("Levothyroxine 5O rncg; vitamin B12 25 meg; vitamin D 1OOO lU")).toEqual([
      "Levothyroxine 50 mcg; vitamin B12 25 mcg; vitamin D 1000 IU",
    ]);
    // Words and numbers away from a dose are untouched.
    expect(norm("The rng meg and lU words stay. Room lO and 1O0 Oak St.")).toEqual(["The rng meg and lU words stay. Room lO and 1O0 Oak St."]);
  });

  test("stray table borders are removed, inner field separators kept", () => {
    expect(norm("| Start aspirin 81 mg daily. |")).toEqual(["Start aspirin 81 mg daily."]);
    expect(norm("Patient: Ann B. | Visit date: 10/01/2026")).toEqual(["Patient: Ann B. | Visit date: 10/01/2026"]);
  });

  test("hyphenated line breaks rejoin the word, keeping real compound hyphens", () => {
    expect(norm("Call to sched-\nule a visit.")).toEqual(["Call to schedule a visit."]);
    expect(norm("Book a follow-\nup visit.")).toEqual(["Book a follow-up visit."]);
  });

  test("a line ending mid-phrase joins the next line even when it starts with a capital or a number", () => {
    expect(norm("Follow up with Dr. Natarajan on\n11/20/2026 at 10:30 AM.")).toEqual([
      "Follow up with Dr. Natarajan on 11/20/2026 at 10:30 AM.",
    ]);
    // A label on the next line is never pulled up.
    expect(norm("Reason for visit: knee pain and\nProvider: Hannah Brooks, NP")).toHaveLength(2);
  });

  test("a sentence broken by a page break rejoins; a blank line still ends a paragraph", () => {
    expect(norm("Check your blood pressure every morning and\n\n\fwrite it down.")).toEqual([
      "Check your blood pressure every morning and write it down.",
    ]);
    expect(norm("Check your blood pressure\n\nwrite it down.")).toHaveLength(2);
  });
});

describe("medication lists", () => {
  test("notes under a medication stay with it, and a sig without a period does not swallow the next drug", () => {
    const d = parse({
      text: [
        "CONTINUE these medications which have NOT CHANGED",
        "metFORMIN 500 MG tablet",
        "Commonly known as: Glucophage",
        "Take 1 tablet by mouth 2 times daily with meals",
        "albuterol 90 mcg/actuation inhaler",
        "Inhale 2 puffs every 4 hours as needed for wheezing.",
      ].join("\n"),
    });
    expect(d.medications.map((m) => [m.name, m.kind])).toEqual([
      ["Metformin", "continue"],
      ["Albuterol", "continue"],
    ]);
    expect(d.medications[0].detail).toContain("Commonly known as: Glucophage");
    expect(d.medications[1].detail).toContain("Inhale 2 puffs every 4 hours as needed");
    expect(d.otherNotes).toEqual([]);
  });

  test("hospital-style group headings set the kind", () => {
    const d = parse({
      text: "NEW medications - START taking these\ncephalexin 500 mg capsule\n\nSTOPPED medications - do NOT take these\nibuprofen 400 mg tablet",
    });
    expect(d.medications.map((m) => [m.name, m.kind])).toEqual([
      ["Cephalexin", "new"],
      ["Ibuprofen", "stopped"],
    ]);
  });
});
