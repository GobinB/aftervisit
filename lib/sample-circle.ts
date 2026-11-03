import type { CircleContent, PersonView } from "@/lib/schema/circles";

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
