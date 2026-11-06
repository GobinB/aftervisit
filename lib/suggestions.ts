import type { MedSchedule } from "@/lib/schema/medications";

/** Tap-to-pick values, so fewer words need typing. Anything can still be typed instead. */
export const STRENGTHS = ["2.5 mg", "5 mg", "10 mg", "20 mg", "25 mg", "40 mg", "50 mg", "81 mg", "100 mg", "500 mg", "1000 mg"];
export const AMOUNTS = ["1 tablet", "2 tablets", "½ tablet", "1 capsule", "5 mL", "1 puff", "1 drop"];
export const REASONS = ["Blood pressure", "Diabetes", "Cholesterol", "Heart", "Pain", "Thyroid", "Sleep", "Mood", "Stomach"];
export const INSTRUCTIONS = ["With food", "Before breakfast", "With water", "At bedtime", "Do not crush"];

export type HowOften = { key: string; label: string; schedule: MedSchedule; times: string[] };

/** Common ways a medicine is taken, as one tap: the schedule and the times to go with it. */
export const HOW_OFTEN: HowOften[] = [
  { key: "morning", label: "Once a day, morning", schedule: "daily", times: ["08:00"] },
  { key: "evening", label: "Once a day, evening", schedule: "daily", times: ["18:00"] },
  { key: "twice", label: "Twice a day", schedule: "daily", times: ["08:00", "20:00"] },
  { key: "three", label: "3 times a day", schedule: "daily", times: ["08:00", "14:00", "20:00"] },
  { key: "bedtime", label: "At bedtime", schedule: "daily", times: ["21:00"] },
  { key: "as_needed", label: "Only when needed", schedule: "as_needed", times: [] },
];

/** Which one-tap choice the current schedule matches, if any. */
export function howOftenKey(schedule: MedSchedule, times: string[]): string | null {
  const clean = times.filter(Boolean).join(",");
  return HOW_OFTEN.find((item) => item.schedule === schedule && (schedule === "as_needed" || item.times.join(",") === clean))?.key ?? null;
}

/** Everyday reminders, one tap to fill in. */
export const COMMON_REMINDERS = [
  "Pick up prescription",
  "Book a follow-up appointment",
  "Call the doctor's office",
  "Refill the pill organizer",
  "Get blood work done",
  "Drive to the appointment",
  "Grocery shopping",
  "Check in by phone",
];

/** Event names from the circle's own doctors first, then common ones. */
export function eventSuggestions(doctors: { name: string; specialty?: string }[]): string[] {
  const fromDoctors = doctors.slice(0, 4).map((doctor) => (doctor.specialty ? `${doctor.specialty} appointment with ${doctor.name}` : `Appointment with ${doctor.name}`));
  return [...fromDoctors, "Doctor appointment", "Blood work", "Pharmacy pickup", "Physical therapy", "Dentist"];
}
