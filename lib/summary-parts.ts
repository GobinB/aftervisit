/** The parts of the care summary that can be filled in one at a time, from a card on Today. */
export const SUMMARY_PARTS = ["allergies", "doctors", "contacts", "pharmacy", "poa"] as const;
export type SummaryPart = (typeof SUMMARY_PARTS)[number];

export const PART_TITLES: Record<SummaryPart, string> = {
  allergies: "Allergies",
  doctors: "Doctors",
  contacts: "Who to call in an emergency",
  pharmacy: "Pharmacy",
  poa: "Power of attorney",
};
