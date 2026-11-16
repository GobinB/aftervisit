import { describe, expect, test } from "vitest";
import { emergencyPeople } from "@/lib/emergency";
import type { PersonView } from "@/lib/schema/circles";

const person = (id: string, kind: PersonView["kind"], phone: string | null, extra: Partial<PersonView> = {}): PersonView => ({
  id,
  name: `Person ${id}`,
  role: kind === "caregiver" ? "owner" : "family",
  roleLabel: kind === "caregiver" ? "Caregiver" : "Family",
  kind,
  phone,
  ...extra,
});

describe("the People part of the Emergency page", () => {
  const people = [
    person("aide", "member", "555-010-0188"),
    person("owner", "caregiver", "555-010-0100"),
    person("family", "member", null),
    person("gone", "member", "555-010-0111", { revokedAt: "2026-11-01T00:00:00Z" }),
    person("me", "member", "555-010-0166"),
  ];

  test("everyone else with a number, the caregiver first", () => {
    const { withPhone } = emergencyPeople(people, "me");
    expect(withPhone.map((p) => p.id)).toEqual(["owner", "aide"]);
  });

  test("nobody is offered a call to themselves; their own number is known", () => {
    const view = emergencyPeople(people, "me");
    expect(view.withPhone.some((p) => p.id === "me")).toBe(false);
    expect(view.ownPhone).toBe("555-010-0166");
    expect(emergencyPeople(people, "owner").ownPhone).toBe("555-010-0100");
    expect(emergencyPeople(people, "family").ownPhone).toBeNull();
  });

  test("a person whose link was turned off is left out", () => {
    const view = emergencyPeople(people, "owner");
    expect(view.withPhone.some((p) => p.id === "gone")).toBe(false);
    expect(view.withoutPhone.some((p) => p.id === "gone")).toBe(false);
  });

  test("people with a link and no number are listed for the caregiver to add", () => {
    expect(emergencyPeople(people, "owner").withoutPhone.map((p) => p.id)).toEqual(["family"]);
    // The caregiver without a number is not on that list; the page asks them for their own instead.
    const noOwner = emergencyPeople([person("owner", "caregiver", null), person("aide", "member", null)], "aide");
    expect(noOwner.withoutPhone.map((p) => p.id)).toEqual([]);
  });

  test("a blank number counts as none", () => {
    expect(emergencyPeople([person("a", "member", "  ")], "x").withPhone).toEqual([]);
  });
});
