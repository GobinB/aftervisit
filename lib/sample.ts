/**
 * Appendix A demo visit. Entirely fictional. Used for "Start with a sample visit",
 * the application video, the OG preview and /public/sample-avs.pdf.
 */
import type { HandoffDraft, RecipientShare } from "./schema";

export const SAMPLE_SOURCE_TEXT = `RIVERBEND INTERNAL MEDICINE - AFTER VISIT SUMMARY
Patient: Margaret W.    Visit date: 10/03/2026    Provider: Anita Patel, MD (Internal Medicine)
Reason for visit: Follow-up, hypertension; new complaint of dizziness when standing.

Assessment: Blood pressure remains above goal (158/92 today). Lightheadedness on standing likely related to meclizine and dehydration; no signs of inner-ear cause today.

Medication changes:
- INCREASE lisinopril to 20 mg once daily in the morning (was 10 mg).
- STOP meclizine 25 mg. Do not take unless instructed.
- CONTINUE atorvastatin 40 mg nightly.
Check blood pressure at home every morning before medications and write it down. Bring the log to the next visit.

Orders / referrals:
- Physical therapy referral for balance and fall prevention. Please call to schedule within 2 weeks.
- Lab: basic metabolic panel in 2 weeks to check kidney function and potassium after the dose change.
- Return visit in 6 weeks with Dr. Patel.

Call the clinic if: dizziness gets worse, any fall, swelling of the lips or face, or home blood pressure readings below 100/60 or above 180/110.
Discuss at next visit: whether to start a vitamin D supplement; sleep concerns raised by daughter.
Drink at least 6 glasses of water daily unless told otherwise.`;

// Exact sentences from SAMPLE_SOURCE_TEXT, so every item traces back to the fictional source.
export const SAMPLE_QUOTES = {
  lisinopril: "INCREASE lisinopril to 20 mg once daily in the morning (was 10 mg).",
  meclizine: "STOP meclizine 25 mg. Do not take unless instructed.",
  atorvastatin: "CONTINUE atorvastatin 40 mg nightly.",
  bpLog: "Check blood pressure at home every morning before medications and write it down. Bring the log to the next visit.",
  pt: "Physical therapy referral for balance and fall prevention. Please call to schedule within 2 weeks.",
  lab: "Lab: basic metabolic panel in 2 weeks to check kidney function and potassium after the dose change.",
  returnVisit: "Return visit in 6 weeks with Dr. Patel.",
  water: "Drink at least 6 glasses of water daily unless told otherwise.",
  watch: "Call the clinic if: dizziness gets worse, any fall, swelling of the lips or face, or home blood pressure readings below 100/60 or above 180/110.",
};

export const SAMPLE_DRAFT: HandoffDraft = {
  visit: {
    patientFirstName: "Margaret",
    date: "2026-10-03",
    provider: "Dr. Anita Patel",
    specialty: "Internal Medicine",
    clinic: "Riverbend Internal Medicine",
    reason: "Blood pressure follow-up and dizziness when standing",
    summary:
      "Margaret's blood pressure is still higher than the clinic wants. Dr. Patel increased the blood pressure medicine, stopped the dizziness medicine, and asked for daily home readings, a lab test in two weeks, and a physical therapy evaluation for balance.",
  },
  medications: [
    {
      id: "med_sample_1",
      kind: "dose_changed",
      name: "Lisinopril",
      detail: "20 mg once daily in the morning (was 10 mg)",
      sourceQuote: SAMPLE_QUOTES.lisinopril,
      confidence: "high",
    },
    {
      id: "med_sample_2",
      kind: "stopped",
      name: "Meclizine",
      detail: "Stop taking. Do not use unless the clinic says to.",
      sourceQuote: SAMPLE_QUOTES.meclizine,
      confidence: "high",
    },
    {
      id: "med_sample_3",
      kind: "continue",
      name: "Atorvastatin",
      detail: "40 mg every night, no change",
      sourceQuote: SAMPLE_QUOTES.atorvastatin,
      confidence: "high",
    },
  ],
  tasks: [
    {
      id: "task_sample_1",
      title: "Check blood pressure every morning before medicines and write it down",
      category: "home",
      dueText: "daily, bring the log to the next visit",
      sourceQuote: SAMPLE_QUOTES.bpLog,
      confidence: "high",
    },
    {
      id: "task_sample_2",
      title: "Call to schedule physical therapy for balance",
      category: "referral",
      dueText: "within 2 weeks",
      sourceQuote: SAMPLE_QUOTES.pt,
      confidence: "high",
    },
    {
      id: "task_sample_3",
      title: "Arrange the basic metabolic panel blood test",
      category: "lab",
      dueText: "in 2 weeks",
      sourceQuote: SAMPLE_QUOTES.lab,
      confidence: "high",
    },
    {
      id: "task_sample_4",
      title: "Book the return visit with Dr. Patel",
      category: "appointment",
      dueText: "in 6 weeks",
      sourceQuote: SAMPLE_QUOTES.returnVisit,
      confidence: "high",
    },
    {
      id: "task_sample_5",
      title: "Make sure Margaret drinks at least 6 glasses of water a day",
      category: "home",
      dueText: "daily",
      sourceQuote: SAMPLE_QUOTES.water,
      confidence: "high",
    },
  ],
  watchFor: [
    "Dizziness that gets worse",
    "Any fall",
    "Swelling of the lips or face",
    "Home blood pressure below 100/60 or above 180/110",
  ],
  questions: ["Should Margaret start a vitamin D supplement?", "Sleep concerns raised by Margaret's daughter"],
  otherNotes: [],
  sourceText: SAMPLE_SOURCE_TEXT,
};

/** Who gets the sample handoff. Lisa is Margaret's daughter; all fictional. */
export const SAMPLE_RECIPIENTS: RecipientShare[] = [
  { name: "Lisa", role: "family" },
  { name: "Rosa", role: "home_aide" },
  { name: "Dana", role: "care_manager" },
  // The day program only needs the medication change and what to watch for.
  { name: "Sunrise Adult Day Health", role: "day_program", sections: ["medications", "watchFor", "summary"], tasksScope: "mine" },
];

/** The caregiver's assignments (not the clinic's): who handles each step. */
export const SAMPLE_ASSIGNEES: Record<string, string> = {
  task_sample_1: "Rosa",
  task_sample_2: "Lisa",
  task_sample_3: "Dana",
  task_sample_4: "Lisa",
  task_sample_5: "Rosa",
};

export const SAMPLE_CAREGIVER = "Gobin";

/** A fresh copy so edits in the review screen never mutate the constant. */
export function sampleDraft(withAssignees = true): HandoffDraft {
  const d: HandoffDraft = structuredClone(SAMPLE_DRAFT);
  if (withAssignees) {
    d.tasks = d.tasks.map((t) => (SAMPLE_ASSIGNEES[t.id] ? { ...t, assignee: SAMPLE_ASSIGNEES[t.id] } : t));
  }
  return d;
}
