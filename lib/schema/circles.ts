import { z } from "zod";

/** What a caregiver may store about one person. Medical text stays inside this object. */
const line = z.string().trim().min(1).max(200);

export const DoctorSchema = z.object({
  name: z.string().trim().min(1).max(120),
  specialty: z.string().trim().max(80).optional(),
  phone: z.string().trim().max(40).optional(),
});

export const EmergencyContactSchema = z.object({
  name: z.string().trim().min(1).max(80),
  relationship: z.string().trim().max(80).optional(),
  phone: z.string().trim().max(40).optional(),
});

export const PharmacySchema = z.object({
  name: z.string().trim().max(120),
  phone: z.string().trim().max(40).optional(),
  address: z.string().trim().max(200).optional(),
});

export const CircleContentSchema = z.object({
  person_name: z.string().trim().min(1).max(120),
  allergies: z.array(line).max(50).default([]),
  doctors: z.array(DoctorSchema).max(30).default([]),
  pharmacy: PharmacySchema.optional(),
  emergency_contacts: z.array(EmergencyContactSchema).max(20).default([]),
  poa_location: z.string().trim().max(300).optional(),
});
export type CircleContent = z.infer<typeof CircleContentSchema>;

export const HELPER_ROLES = ["family", "care_manager", "home_aide", "day_program"] as const;
export const HelperRoleSchema = z.enum(HELPER_ROLES);
export type HelperRole = z.infer<typeof HelperRoleSchema>;

export const HELPER_ROLE_LABELS: Record<HelperRole, string> = {
  family: "Family",
  care_manager: "Care manager",
  home_aide: "Home aide",
  day_program: "Day program",
};

export const CAREGIVER_ROLE_LABELS = {
  owner: "Owner",
  co_caregiver: "Co-caregiver",
} as const;

/** Areas a caregiver can hide for one person. Hiding only removes access. */
export const VISIBILITY_AREAS = ["updates", "medications", "tasks", "calendar", "documents", "summary", "handoff"] as const;
export type VisibilityArea = (typeof VISIBILITY_AREAS)[number];

export const AREA_LABELS: Record<VisibilityArea, string> = {
  updates: "Updates",
  medications: "Medications",
  tasks: "Tasks",
  calendar: "Calendar",
  documents: "Documents",
  summary: "Care summary",
  handoff: "Handoff",
};

export const HANDOFF_SECTION_KEYS = ["medications", "tasks", "watchFor", "questions", "summary", "otherNotes", "original"] as const;

export const VisibilitySchema = z
  .object({
    hidden: z.array(z.enum(VISIBILITY_AREAS)).max(VISIBILITY_AREAS.length).optional(),
    handoffSections: z.array(z.enum(HANDOFF_SECTION_KEYS)).max(HANDOFF_SECTION_KEYS.length).optional(),
    /** Narrows who appears on the people list. It cannot grant manage. */
    members: z.enum(["caregivers", "off"]).optional(),
  })
  .strict();
export type Visibility = z.infer<typeof VisibilitySchema>;

export const CONSENT_VERSION = "2026-11-02";
export const CONSENT_TYPES = ["authorized_to_share", "terms", "privacy"] as const;
export type ConsentType = (typeof CONSENT_TYPES)[number];

/** Shown next to the checkbox. The hash stored in consents is of this exact text. */
export const CONSENT_TEXT: Record<ConsentType, string> = {
  authorized_to_share:
    "I am this person, or they or their legal representative have authorized me to store and share information about their care in AfterVisit.",
  terms: "I agree to use AfterVisit to store what I enter. AfterVisit does not provide medical advice.",
  privacy: "I understand caregivers I add can open this circle, helpers see only what I allow, and I can delete the circle.",
};

export const CONSENT_LABELS: Record<ConsentType, string> = {
  authorized_to_share: CONSENT_TEXT.authorized_to_share,
  terms: CONSENT_TEXT.terms,
  privacy: CONSENT_TEXT.privacy,
};

export const CreateCircleSchema = z.object({
  content: CircleContentSchema,
  consents: z.object({
    authorized_to_share: z.literal(true),
    terms: z.literal(true),
    privacy: z.literal(true),
  }),
});
export type CreateCircleInput = z.infer<typeof CreateCircleSchema>;

const optionalEmail = z
  .string()
  .trim()
  .max(200)
  .refine((value) => value === "" || z.string().email().safeParse(value).success, "Enter an email address or leave it blank.")
  .optional();

export const AddMemberSchema = z.object({
  circleId: z.string().uuid(),
  name: z.string().trim().min(1).max(80),
  role: HelperRoleSchema,
  email: optionalEmail,
  pin: z.string().regex(/^\d{4}$/).optional(),
  visibility: VisibilitySchema.optional(),
});

export type AddMemberInput = z.infer<typeof AddMemberSchema>;

export const MemberChangeSchema = z.object({
  circleId: z.string().uuid(),
  memberId: z.string().uuid(),
});

export const ChangeRoleSchema = MemberChangeSchema.extend({ role: HelperRoleSchema });
export const SetVisibilitySchema = MemberChangeSchema.extend({ visibility: VisibilitySchema });

export const MEMBER_TTL_DAYS = 90;

export interface PersonView {
  id: string;
  name: string;
  role: string;
  roleLabel: string;
  kind: "caregiver" | "member";
  lastSeenAt?: string | null;
  expiresAt?: string | null;
  revokedAt?: string | null;
  locked?: boolean;
  email?: string | null;
}
