import { expect, test } from "vitest";
import { scrubIdentifiers } from "@/lib/scrub";
import { SAMPLE_SOURCE_TEXT } from "@/lib/sample";

test("removes DOB, MRN, phone, address, insurance and patient name", () => {
  const src = [
    "Patient: Margaret Wilson    Visit date: 10/03/2026    Provider: Anita Patel, MD",
    "DOB: 04/12/1941   MRN: 00482913",
    "Address: 12 Elm Street, Apt 4",
    "Insurance ID: XKJ-99812-01",
    "Call 555-201-0142 with questions.",
    "SSN 123-45-6789",
    "INCREASE lisinopril to 20 mg once daily.",
  ].join("\n");
  const out = scrubIdentifiers(src);
  expect(out).not.toMatch(/Wilson|1941|00482913|Elm Street|XKJ-99812|201-0142|123-45-6789/);
  expect(out).toContain("Visit date: 10/03/2026");
  expect(out).toContain("Provider: Anita Patel, MD");
  expect(out).toContain("INCREASE lisinopril to 20 mg once daily.");
});

test("keeps clinical content of the sample untouched", () => {
  const out = scrubIdentifiers(SAMPLE_SOURCE_TEXT);
  expect(out).toContain("Call the clinic if: dizziness gets worse");
  expect(out).toContain("home blood pressure readings below 100/60 or above 180/110");
  expect(out).not.toContain("Margaret W.");
});
