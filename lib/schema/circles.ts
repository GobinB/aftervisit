import { z } from "zod";
import { PhoneInputSchema } from "@/lib/phone";

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

/** An IANA time zone ("America/New_York") the runtime knows. Checked with Intl only, so this file stays light for the browser. */
export const TimeZoneSchema = z
  .string()
  .max(64)
  .regex(/^[A-Za-z_]+(\/[A-Za-z0-9_+-]+)*$/)
  .refine((value) => {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: value });
      return true;
    } catch {
      return false;
    }
  });

export const CircleContentSchema = z.object({
  person_name: z.string().trim().min(1).max(120),
  allergies: z.array(line).max(50).default([]),
  doctors: z.array(DoctorSchema).max(30).default([]),
  pharmacy: PharmacySchema.optional(),
  emergency_contacts: z.array(EmergencyContactSchema).max(20).default([]),
  poa_location: z.string().trim().max(300).optional(),
  /** Where the person lives, for "today" and the calendar link. Taken from the caregiver's device once. */
  time_zone: TimeZoneSchema.optional(),
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
  owner: "Caregiver",
} as const;

/** Areas a caregiver can hide for one person. Hiding only removes access. */
export const VISIBILITY_AREAS = ["updates", "medications", "tasks", "calendar", "documents", "summary", "handoff"] as const;
export type VisibilityArea = (typeof VISIBILITY_AREAS)[number];

export const AREA_LABELS: Record<VisibilityArea, string> = {
  updates: "Updates",
  medications: "Medications",
  tasks: "Reminders",
  calendar: "Calendar",
  documents: "Documents",
  summary: "Care summary",
  handoff: "Visit notes",
};

/** Areas a helper can see today. The picker lists only these. Add an area here in the PR that ships it. */
export const READY_AREAS: readonly VisibilityArea[] = ["calendar", "tasks", "medications", "summary", "handoff"];

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

/** The date on the terms page. The consents saved with a new circle carry it as their version. */
export const TERMS_EFFECTIVE = "November 16, 2026";
export const CONSENT_VERSION = "2026-11-16";
export const CONSENT_TYPES = ["authorized_to_share", "terms", "privacy"] as const;
export type ConsentType = (typeof CONSENT_TYPES)[number];

/** Shown next to the checkbox. The hash stored in consents is of this exact text. */
export const CONSENT_TEXT: Record<ConsentType, string> = {
  authorized_to_share:
    "I am this person, or they or their legal representative have authorized me to store and share information about their care in All Hands Care.",
  terms: "I agree to the terms of use. All Hands Care does not give medical advice and is not for emergencies.",
  privacy: "I understand the people I add see only what I allow, and I can delete the circle.",
};

export const CONSENT_LABELS: Record<ConsentType, string> = {
  authorized_to_share: CONSENT_TEXT.authorized_to_share,
  terms: CONSENT_TEXT.terms,
  privacy: CONSENT_TEXT.privacy,
};

/**
 * av2 is how a circle's key for files is stored: wrapped on the server (lib/key-custody.ts) with a
 * key derived from a secret that is not in the database. A 12-byte IV, then the 32-byte key and
 * AES-GCM's 16-byte tag, both base64url.
 */
export const HELD_CIRCLE_KEY = /^av2\.([A-Za-z0-9_-]{16})\.([A-Za-z0-9_-]{64})$/;

/**
 * Where a circle's key for files stands, for the pages that need it.
 * - none: no key yet. One is made the first time it is needed.
 * - held: All Hands Care holds it, so it is handed to the caregiver after sign-in.
 */
export type CircleKeyState = { keyVersion: number; state: "none" | "held" };

export const CreateCircleSchema = z
  .object({
    content: CircleContentSchema,
    consents: z.object({
      authorized_to_share: z.literal(true),
      terms: z.literal(true),
      privacy: z.literal(true),
    }),
  })
  .strict();
export type CreateCircleInput = z.infer<typeof CreateCircleSchema>;

/** Token and optional PIN only. A key fragment is not a field. */
export const OpenMemberLinkSchema = z
  .object({
    token: z.string().regex(/^[A-Za-z0-9_-]{24}$/),
    pin: z.string().regex(/^\d{4}$/).optional(),
  })
  .strict();

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
  phone: PhoneInputSchema.optional(),
  pin: z.string().regex(/^\d{4}$/).optional(),
  visibility: VisibilitySchema.optional(),
}).strict();

export type AddMemberInput = z.infer<typeof AddMemberSchema>;

export const MemberChangeSchema = z
  .object({
    circleId: z.string().uuid(),
    memberId: z.string().uuid(),
  })
  .strict();

export const ChangeRoleSchema = MemberChangeSchema.extend({ role: HelperRoleSchema });
export const SetVisibilitySchema = MemberChangeSchema.extend({ visibility: VisibilitySchema });
/** The caregiver sets or clears one person's number. Blank clears it. */
export const SetMemberPhoneSchema = MemberChangeSchema.extend({ phone: PhoneInputSchema });
/** Anyone sets or clears their own number: the caregiver on their row, a person on their link. */
export const SetOwnPhoneSchema = z.object({ circleId: z.string().uuid(), phone: PhoneInputSchema }).strict();

/** How long a person's browser stays signed in after it last opened the circle; the link's own limits are in lib/link-life.ts. */
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
  /** Shown to whoever may see this person on the list; never required. */
  phone?: string | null;
  /** Areas hidden from this person. Only for a viewer who may manage people. */
  hidden?: string[];
}
