import { describe, expect, test } from "vitest";
import { caregiverDisplayName } from "@/lib/caregiver-name";

describe("caregiver display name", () => {
  test("uses the Google profile name, then a given and family name", () => {
    expect(caregiverDisplayName({ full_name: "Sam Example" })).toBe("Sam Example");
    expect(caregiverDisplayName({ name: "  Sam Example  " })).toBe("Sam Example");
    expect(caregiverDisplayName({ given_name: "Sam", family_name: "Example" })).toBe("Sam Example");
  });

  test("returns nothing when the profile has no name, so the role label can stand in", () => {
    expect(caregiverDisplayName(null)).toBeNull();
    expect(caregiverDisplayName({})).toBeNull();
    expect(caregiverDisplayName({ email: "sam.example@example.com" })).toBeNull();
    expect(caregiverDisplayName({ name: "   " })).toBeNull();
  });
});
