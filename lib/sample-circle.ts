import type { CircleContent, PersonView } from "@/lib/schema/circles";
import type { Medication } from "@/lib/schema/medications";
import type { TodoRow } from "@/components/todos/TodoList";
import type { CalendarItem } from "@/lib/calendar-rows";

/** A fictional circle, shown on the home page through the same components the app uses. */
export const SAMPLE_CIRCLE: CircleContent = {
  person_name: "Margaret Lee",
  allergies: ["Penicillin", "Shellfish"],
  doctors: [
    { name: "Dr. Anita Patel", specialty: "internal medicine", phone: "(555) 010-2231" },
    { name: "Dr. Samuel Ortiz", specialty: "cardiology", phone: "(555) 010-4410" },
  ],
  pharmacy: { name: "Riverbend Pharmacy", phone: "(555) 010-7782", address: "12 Mill Street" },
  emergency_contacts: [
    { name: "Lisa Lee", relationship: "daughter", phone: "(555) 010-9034" },
    { name: "David Lee", relationship: "son", phone: "(555) 010-5512" },
  ],
};

const hoursAgo = (hours: number) => new Date(Date.UTC(2026, 9, 6, 15, 0) - hours * 3_600_000).toISOString();

export const SAMPLE_PEOPLE: PersonView[] = [
  { id: "sample-lisa", name: "Lisa Lee", role: "family", roleLabel: "Family", kind: "member", lastSeenAt: hoursAgo(2) },
  { id: "sample-rosa", name: "Rosa Diaz", role: "home_aide", roleLabel: "Home aide", kind: "member", lastSeenAt: hoursAgo(20) },
  { id: "sample-sunrise", name: "Sunrise Adult Day", role: "day_program", roleLabel: "Day program", kind: "member", lastSeenAt: null },
  { id: "sample-dana", name: "Dana Brooks", role: "care_manager", roleLabel: "Care manager", kind: "member", lastSeenAt: hoursAgo(50) },
];

const med = (fields: Partial<Medication> & Pick<Medication, "id" | "name">): Medication => ({
  dose: null,
  amount: null,
  form: null,
  schedule: "daily",
  every: null,
  weekdays: [],
  times: [],
  startDate: null,
  stopDate: null,
  status: "active",
  reason: null,
  instructions: null,
  prescriber: null,
  refillsLeft: null,
  lastRefill: null,
  source: "caregiver",
  updatedAt: "2026-10-06T15:00:00Z",
  ...fields,
});

/** Fictional medications for the home page preview. */
export const SAMPLE_MEDICATIONS: Medication[] = [
  med({ id: "sample-lisinopril", name: "Lisinopril", dose: "10 mg", amount: "1 tablet", times: ["08:00"], reason: "blood pressure", startDate: "2026-03-02" }),
  med({ id: "sample-metformin", name: "Metformin", dose: "500 mg", amount: "1 tablet", times: ["08:00", "18:00"], reason: "blood sugar", instructions: "With food" }),
  med({ id: "sample-vitd", name: "Vitamin D3", dose: "1,000 IU", schedule: "weekdays", weekdays: [1, 3, 5], times: ["08:00"] }),
  med({ id: "sample-acetaminophen", name: "Acetaminophen", dose: "500 mg", amount: "2 tablets", schedule: "as_needed", reason: "pain", instructions: "No more than 6 tablets a day" }),
];

const row = (fields: Partial<TodoRow> & Pick<TodoRow, "id" | "title" | "ownerLabel">): TodoRow => ({
  note: null,
  dueDate: null,
  assignee: { kind: "caregiver" },
  status: "open",
  doneAt: null,
  createdAt: "2026-10-06T15:00:00Z",
  canToggle: false,
  canClaim: false,
  ...fields,
});

/** Fictional to-dos for the home page preview. */
export const SAMPLE_TODOS: TodoRow[] = [
  row({ id: "sample-insurance", title: "Call the insurance company about the walker", ownerLabel: "You", dueDate: "2026-10-08", note: "Member ID is on the back of the card" }),
  row({ id: "sample-pharmacy", title: "Pick up the new prescription", ownerLabel: "Rosa Diaz", assignee: { kind: "member", memberId: "sample-rosa" }, dueDate: "2026-10-07" }),
  row({ id: "sample-ride", title: "Drive Margaret to the eye exam on Friday", ownerLabel: "Needs a volunteer", assignee: null, dueDate: "2026-10-10" }),
  row({ id: "sample-forms", title: "Send the day program the new medication list", ownerLabel: "Lisa Lee", assignee: { kind: "member", memberId: "sample-lisa" }, status: "done", doneAt: "2026-10-05T15:00:00Z" }),
];

const item = (fields: Partial<CalendarItem> & Pick<CalendarItem, "key" | "date" | "title" | "time">): CalendarItem => ({
  kind: "event",
  id: fields.key,
  sortTime: "",
  location: null,
  notes: null,
  who: null,
  needsSomeone: false,
  canGo: false,
  repeats: false,
  ...fields,
});

/** Fictional calendar for the home page preview. */
export const SAMPLE_CALENDAR: CalendarItem[] = [
  item({ key: "sample-pt", date: "2026-10-07", title: "Physical therapy", time: "9 AM to 10 AM", location: "Riverbend Rehab", who: "Rosa Diaz", repeats: true }),
  item({ key: "sample-cardio", date: "2026-10-09", title: "Cardiology follow-up", time: "10:30 AM", location: "Riverbend Clinic, 2nd floor", notes: "Bring the medication list", needsSomeone: true }),
  item({ key: "sample-refill", date: "2026-10-09", title: "Pick up the new prescription", time: "Reminder due", kind: "todo", who: "Rosa Diaz" }),
  item({ key: "sample-birthday", date: "2026-10-12", title: "Lisa's birthday dinner", time: "All day", who: "Lisa Lee" }),
];
