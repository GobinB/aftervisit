import { describe, expect, test } from "vitest";
import { AddMemberSchema, ChangeRoleSchema, CircleContentSchema, CreateCircleSchema, SetVisibilitySchema } from "@/lib/schema/circles";

const WRAPPED = `av1.600000.${"a".repeat(22)}.${"b".repeat(16)}.${"c".repeat(64)}`;

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

  test("create requires every consent, and takes no key or words", () => {
    const content = { person_name: "Margaret Ward" };
    const consents = { authorized_to_share: true as const, terms: true as const, privacy: true as const };
    expect(CreateCircleSchema.safeParse({ content, consents }).success).toBe(true);
    expect(CreateCircleSchema.safeParse({ content, consents, circleKeyWrapped: WRAPPED }).success).toBe(false);
    expect(CreateCircleSchema.safeParse({ content, consents, keyVersion: 1 }).success).toBe(false);
    expect(CreateCircleSchema.safeParse({ content, consents, phrase: "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about" }).success).toBe(false);
    expect(CreateCircleSchema.safeParse({ content, consents: { authorized_to_share: true, terms: true, privacy: false } }).success).toBe(false);
  });

  test("member actions accept their own fields only", () => {
    const circleId = "22222222-2222-4222-8222-222222222222";
    const memberId = "33333333-3333-4333-8333-333333333333";
    expect(ChangeRoleSchema.safeParse({ circleId, memberId, role: "family" }).success).toBe(true);
    expect(ChangeRoleSchema.safeParse({ circleId, memberId, role: "family", token: "abcdefghijklmnopqrstuvwx" }).success).toBe(false);
    expect(SetVisibilitySchema.safeParse({ circleId, memberId, visibility: {} }).success).toBe(true);
    expect(AddMemberSchema.safeParse({ circleId, name: "Rosa", role: "family" }).success).toBe(true);
  });
});
