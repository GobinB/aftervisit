import { describe, expect, test } from "vitest";
import { CircleContentSchema, CreateCircleSchema } from "@/lib/schema/circles";

describe("circle content", () => {
  test("accepts a fictional circle and keeps medical fields inside content", () => {
    const content = CircleContentSchema.parse({
      person_name: "Margaret Ward",
      allergies: ["Penicillin"],
      doctors: [{ name: "Anita Patel, MD", specialty: "Internal medicine" }],
      pharmacy: { name: "Riverbend Pharmacy", phone: "555-0199" },
      emergency_contacts: [{ name: "Lisa Ward", relationship: "Daughter", phone: "555-0142" }],
      poa_location: "Kitchen drawer",
    });
    expect(content.person_name).toBe("Margaret Ward");
    expect(content.allergies).toEqual(["Penicillin"]);
  });

  test("rejects a circle with no name", () => {
    expect(CircleContentSchema.safeParse({ person_name: "  " }).success).toBe(false);
  });

  test("create requires every consent", () => {
    const content = { person_name: "Margaret Ward" };
    expect(CreateCircleSchema.safeParse({ content, consents: { authorized_to_share: true, terms: true, privacy: true } }).success).toBe(true);
    expect(CreateCircleSchema.safeParse({ content, consents: { authorized_to_share: true, terms: true, privacy: false } }).success).toBe(false);
  });
});
