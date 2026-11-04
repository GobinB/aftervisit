import { z } from "zod";

export const MED_FORMS = ["tablet", "capsule", "liquid", "injection", "inhaler", "patch", "cream", "drops", "other"] as const;
export const MED_FORM_LABELS: Record<(typeof MED_FORMS)[number], string> = {
  tablet: "Tablet",
  capsule: "Capsule",
  liquid: "Liquid",
  injection: "Injection",
  inhaler: "Inhaler",
  patch: "Patch",
  cream: "Cream",
  drops: "Drops",
  other: "Other",
};

export const MED_SCHEDULES = ["daily", "as_needed", "every_x_days", "weekdays", "every_x_weeks", "every_x_months"] as const;
export type MedSchedule = (typeof MED_SCHEDULES)[number];
export const MED_SCHEDULE_LABELS: Record<MedSchedule, string> = {
  daily: "Every day",
  as_needed: "Only when needed",
  every_x_days: "Every few days",
  weekdays: "Certain days of the week",
  every_x_weeks: "Every few weeks",
  every_x_months: "Every few months",
};

export const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value ? value : undefined));
const optionalDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .optional()
  .or(z.literal("").transform(() => undefined));

/** What the caregiver types. The database checks the same limits. */
export const MedicationInputSchema = z
  .object({
    circleId: z.string().uuid(),
    id: z.string().uuid().optional(),
    name: z.string().trim().min(1, "Enter the medication name.").max(120),
    dose: optionalText(80),
    amount: optionalText(80),
    form: z.enum(MED_FORMS).optional().or(z.literal("").transform(() => undefined)),
    schedule: z.enum(MED_SCHEDULES),
    every: z.coerce.number().int().min(1).max(365).optional(),
    weekdays: z.array(z.number().int().min(0).max(6)).max(7).default([]),
    times: z
      .array(z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/))
      .max(8)
      .default([]),
    startDate: optionalDate,
    reason: optionalText(200),
    instructions: optionalText(500),
    prescriber: optionalText(120),
    refillsLeft: z.coerce.number().int().min(0).max(99).optional(),
    lastRefill: optionalDate,
  })
  .strict()
  .superRefine((value, ctx) => {
    if ((value.schedule === "every_x_days" || value.schedule === "every_x_weeks" || value.schedule === "every_x_months") && !value.every) {
      ctx.addIssue({ code: "custom", path: ["every"], message: "Enter how often." });
    }
    if (value.schedule === "weekdays" && value.weekdays.length === 0) {
      ctx.addIssue({ code: "custom", path: ["weekdays"], message: "Pick at least one day." });
    }
  });
export type MedicationInput = z.infer<typeof MedicationInputSchema>;

export const MedicationStatusSchema = z
  .object({ circleId: z.string().uuid(), id: z.string().uuid(), status: z.enum(["active", "stopped"]) })
  .strict();

/** One medication as screens show it. */
export type Medication = {
  id: string;
  name: string;
  dose: string | null;
  amount: string | null;
  form: (typeof MED_FORMS)[number] | null;
  schedule: MedSchedule;
  every: number | null;
  weekdays: number[];
  times: string[];
  startDate: string | null;
  stopDate: string | null;
  status: "active" | "stopped";
  reason: string | null;
  instructions: string | null;
  prescriber: string | null;
  refillsLeft: number | null;
  lastRefill: string | null;
  source: "caregiver" | "handoff";
  updatedAt: string;
};

export type MedicationChange = { id: string; medicationId: string; at: string; change: "added" | "edited" | "stopped" | "restarted"; summary: string };

/** "08:00" -> "8 AM", "20:30" -> "8:30 PM". */
export function clockTime(value: string): string {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return value;
  const hours = Number(match[1]);
  const minutes = match[2];
  const suffix = hours < 12 ? "AM" : "PM";
  const twelve = hours % 12 === 0 ? 12 : hours % 12;
  return minutes === "00" ? `${twelve} ${suffix}` : `${twelve}:${minutes} ${suffix}`;
}

function joinAnd(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/** The schedule in plain words: "Every day at 8 AM and 8 PM", "Mon, Wed and Fri", "Only when needed". */
export function scheduleText(med: Pick<Medication, "schedule" | "every" | "weekdays" | "times">): string {
  const every = med.every ?? 1;
  let when: string;
  switch (med.schedule) {
    case "as_needed":
      return "Only when needed";
    case "daily":
      when = "Every day";
      break;
    case "every_x_days":
      when = every === 1 ? "Every day" : `Every ${every} days`;
      break;
    case "weekdays":
      when = joinAnd([...med.weekdays].sort((a, b) => a - b).map((day) => WEEKDAY_SHORT[day] ?? ""));
      break;
    case "every_x_weeks":
      when = every === 1 ? "Every week" : `Every ${every} weeks`;
      break;
    case "every_x_months":
      when = every === 1 ? "Every month" : `Every ${every} months`;
      break;
  }
  const times = [...med.times].sort();
  return times.length ? `${when} at ${joinAnd(times.map(clockTime))}` : when;
}

/** "10 mg · 1 tablet" */
export function doseText(med: Pick<Medication, "dose" | "amount" | "form">): string {
  const amount = med.amount ?? (med.form ? MED_FORM_LABELS[med.form] : null);
  return [med.dose, amount].filter(Boolean).join(" · ");
}
