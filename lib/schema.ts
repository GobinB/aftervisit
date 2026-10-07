import { z } from "zod";

export const ROLES = ["family", "home_aide", "day_program", "care_manager", "other"] as const;
export const RoleSchema = z.enum(ROLES);
export type Role = z.infer<typeof RoleSchema>;

export const ROLE_LABELS: Record<Role, string> = {
  family: "Family",
  home_aide: "Home aide",
  day_program: "Day program",
  care_manager: "Care manager",
  other: "Other",
};

export const ConfidenceSchema = z.enum(["high", "low"]);
export type Confidence = z.infer<typeof ConfidenceSchema>;

const shortText = z.string().trim().max(300);
const itemText = z.string().trim().max(1000);

export const MED_KINDS = ["new", "stopped", "dose_changed", "continue"] as const;
export const MedicationChangeSchema = z.object({
  id: z.string().min(1).max(40),
  kind: z.enum(MED_KINDS),
  name: shortText, // "Lisinopril"
  detail: itemText, // "20 mg once daily (was 10 mg)"
  reason: shortText.optional(), // only if stated in the source
  sourceQuote: itemText.optional(), // the clinic's original sentence; absent when the caregiver added the item
  origin: z.enum(["summary", "caregiver"]).optional(), // "caregiver" when added during review, not from the summary
  confidence: ConfidenceSchema,
});
export type MedicationChange = z.infer<typeof MedicationChangeSchema>;

export const TASK_CATEGORIES = ["appointment", "referral", "lab", "pharmacy", "home", "other"] as const;
export const TaskSchema = z.object({
  id: z.string().min(1).max(40),
  title: itemText, // "Schedule physical therapy evaluation"
  category: z.enum(TASK_CATEGORIES),
  dueText: shortText.optional(), // "within 2 weeks", "before Nov 14"
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(), // ISO, set by caregiver on review
  assignee: z.string().trim().max(80).optional(), // free text, chosen by caregiver
  sourceQuote: itemText.optional(), // the clinic's original sentence; absent when the caregiver added the item
  origin: z.enum(["summary", "caregiver"]).optional(), // "caregiver" when added during review, not from the summary
  confidence: ConfidenceSchema,
});
export type Task = z.infer<typeof TaskSchema>;

export const VisitSchema = z.object({
  patientFirstName: z.string().trim().max(60).optional(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  provider: shortText.optional(),
  specialty: shortText.optional(),
  clinic: shortText.optional(), // clinic name from the first line of the summary
  reason: itemText.optional(),
  summary: z.string().trim().max(2000), // <= 60 words from the parser; caregiver may edit
});
export type Visit = z.infer<typeof VisitSchema>;

const listItem = z.string().trim().min(1).max(1000);

export const HandoffDraftSchema = z.object({
  visit: VisitSchema,
  medications: z.array(MedicationChangeSchema).max(100),
  tasks: z.array(TaskSchema).max(100),
  watchFor: z.array(listItem).max(100), // symptoms the clinician said to report, verbatim-ish
  questions: z.array(listItem).max(100), // suggested questions for next visit, from source only
  otherNotes: z.array(listItem).max(300), // lines the parser could not place; caregiver sorts or deletes
  sourceText: z.string().max(100_000), // extracted text, shown in the side panel on review
});
export type HandoffDraft = z.infer<typeof HandoffDraftSchema>;

/** What is stored in handoffs.payload: the confirmed draft minus sourceText. */
export const HandoffPayloadSchema = HandoffDraftSchema.omit({ sourceText: true });
export type HandoffPayload = z.infer<typeof HandoffPayloadSchema>;

export const RecipientSchema = z.object({
  name: z.string().trim().min(1).max(80),
  role: RoleSchema,
});
export type Recipient = z.infer<typeof RecipientSchema>;

/** Parts of a handoff the caregiver can choose to share with each person. */
export const SHARE_SECTIONS = ["medications", "tasks", "watchFor", "questions", "summary", "otherNotes", "original"] as const;
export type ShareSection = (typeof SHARE_SECTIONS)[number];
export const SHARE_SECTION_LABELS: Record<ShareSection, string> = {
  medications: "Medication changes",
  tasks: "Next steps",
  watchFor: "Watch for",
  questions: "Questions for next visit",
  summary: "Visit summary",
  otherNotes: "Other notes",
  original: "The original summary (if attached)",
};

export const TasksScopeSchema = z.enum(["all", "mine"]);
export type TasksScope = z.infer<typeof TasksScopeSchema>;

/** A person to share with, and what they can see. */
export const RecipientShareSchema = RecipientSchema.extend({
  sections: z.array(z.enum(SHARE_SECTIONS)).max(SHARE_SECTIONS.length).optional(),
  tasksScope: TasksScopeSchema.optional(),
});
export type RecipientShare = z.infer<typeof RecipientShareSchema>;

export const TASK_STATUSES = ["not_started", "in_progress", "completed"] as const;
export type TaskStatusValue = (typeof TASK_STATUSES)[number];
export const TASK_STATUS_LABELS: Record<TaskStatusValue, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  completed: "Completed",
};

export const TaskUpdateSchema = z.object({
  taskId: z.string().min(1).max(40),
  status: z.enum(TASK_STATUSES),
  note: z.string().trim().max(300).optional(),
});

/** Who changed a task's status, and how. "personal_link" means through that person's own invitation link. */
export interface TaskStatusView {
  status: TaskStatusValue;
  note?: string;
  updatedAt?: string;
  updatedByName?: string;
  updatedVia?: "personal_link" | "creator";
  completedAt?: string;
  assigneeId?: string | null;
}

export const AckSchema = z.object({ name: z.string(), at: z.string() });
export type Ack = z.infer<typeof AckSchema>;

export const PinSchema = z.string().regex(/^\d{4}$/);

/** Body of POST /api/handoffs (JSON, or the "data" field of a multipart request). */
export const CreateHandoffSchema = z.object({
  draft: HandoffDraftSchema,
  recipients: z.array(RecipientShareSchema).min(1).max(20),
  pin: PinSchema.optional(),
  createdByFirstName: z.string().trim().max(60).optional(),
  /** The caregiver confirmed they are the patient or are authorized to share this. */
  consent: z.literal(true),
});
export type CreateHandoffInput = z.infer<typeof CreateHandoffSchema>;

export const ExtractTextSchema = z.object({
  text: z.string().min(1).max(100_000),
  patientFirstName: z.string().trim().max(60).optional(),
});

/** The view a recipient sees. Never includes hashes, source text or storage paths. */
export interface HandoffView {
  token: string;
  payload: HandoffPayload;
  createdByFirstName?: string;
  createdAt: string;
  expiresAt: string;
  recipients: Recipient[];
  ackCount: number;
  hasOriginal: boolean;
  /** Set when viewed through a personal invitation. */
  invite?: {
    recipientName: string;
    recipientRole: Role;
    ackedAt: string | null;
    tasksScope: TasksScope;
    sections: ShareSection[];
    taskStatus: Record<string, TaskStatusView>;
    /** Task ids this person may update: their own, plus unassigned ones they can see. */
    canUpdate: string[];
  };
}
