import { describe, expect, test } from "vitest";
import { CreateCircleSchema } from "@/lib/schema/circles";
import { careSummaryError, explainCreateFailure, personNameError, stepForCreatePath } from "@/lib/circle-form";

const empty = { name: "", extra: "", phone: "" };

describe("new circle form checks", () => {
  test("the name error clears once a name is entered, and a blank name does not", () => {
    expect(personNameError(" ")).toBe("Enter the name of the person you care for.");
    expect(personNameError("Alex Sample")).toBeNull();
    expect(personNameError("A".repeat(121))).toBe("Their name is too long.");
  });

  test("the care summary step rejects a row that would be dropped or is too long", () => {
    expect(
      careSummaryError({
        allergies: "Penicillin",
        doctors: [{ name: "", extra: "Family medicine", phone: "" }],
        pharmacyName: "",
        pharmacyPhone: "555-0172",
        pharmacyAddress: "",
        contacts: [empty],
        poa: "",
      }),
    ).toBe("Enter the doctor's name, or clear that row.");
    expect(
      careSummaryError({
        allergies: "",
        doctors: [empty],
        pharmacyName: "",
        pharmacyPhone: "",
        pharmacyAddress: "12 Example Avenue",
        contacts: [empty],
        poa: "",
      }),
    ).toBe("Enter the pharmacy name, or clear the phone and address.");
    expect(
      careSummaryError({
        allergies: "A".repeat(201),
        doctors: [empty],
        pharmacyName: "",
        pharmacyPhone: "",
        pharmacyAddress: "",
        contacts: [{ name: "", extra: "", phone: "555-0108" }],
        poa: "B".repeat(301),
      }),
    ).toBe("An allergy is too long.");
    expect(
      careSummaryError({
        allergies: "Penicillin\nPeanuts",
        doctors: [{ name: "Dr. Priya Nair", extra: "Family medicine", phone: "555-0148" }],
        pharmacyName: "Corner Drug",
        pharmacyPhone: "555-0172",
        pharmacyAddress: "12 Example Avenue",
        contacts: [{ name: "Sam Example", extra: "Caregiver", phone: "555-0108" }],
        poa: "Folder labeled POA in the desk drawer",
      }),
    ).toBeNull();
  });

  test("a server rejection points at the step that holds the field", () => {
    expect(stepForCreatePath(["content", "person_name"])).toBe(0);
    expect(stepForCreatePath(["content", "doctors", 0, "name"])).toBe(1);
    expect(stepForCreatePath(["content", "pharmacy", "phone"])).toBe(1);
    expect(stepForCreatePath(["consents", "privacy"])).toBe(2);
    expect(stepForCreatePath(["circleKeyWrapped"])).toBeNull();

    const tooLong = CreateCircleSchema.safeParse({
      content: { person_name: "A".repeat(121) },
      consents: { authorized_to_share: true, terms: true, privacy: true },
    });
    expect(tooLong.success).toBe(false);
    if (!tooLong.success) {
      const failure = explainCreateFailure(tooLong.error);
      expect(failure.step).toBe(0);
      expect(failure.error).toBe("Their name is too long.");
    }

    const pharmacy = CreateCircleSchema.safeParse({
      content: { person_name: "Alex Sample", pharmacy: { name: "C".repeat(121) } },
      consents: { authorized_to_share: true, terms: true, privacy: true },
    });
    expect(pharmacy.success).toBe(false);
    if (!pharmacy.success) expect(explainCreateFailure(pharmacy.error).step).toBe(1);
  });
});
