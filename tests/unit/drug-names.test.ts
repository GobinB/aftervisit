import { describe, expect, it } from "vitest";
import { displayDrugName, rankDrugNames } from "@/lib/drug-names";

const LIST = [
  "Subtilisin",
  "Insulin glulisine, human",
  "hydroCHLOROthiazide / lisinopril",
  "Lisinopril anhydrous",
  "Lisinopril",
  "metFORMIN / SITagliptin",
  "metFORMIN hydrochloride",
  "metFORMIN",
  "Aspirin",
  "Aspirin / caffeine",
];

describe("drug name suggestions", () => {
  it("shows tall-man names in plain case", () => {
    expect(displayDrugName("metFORMIN")).toBe("Metformin");
    expect(displayDrugName("hydroCHLOROthiazide / lisinopril")).toBe("Hydrochlorothiazide / lisinopril");
    expect(displayDrugName("Lisinopril")).toBe("Lisinopril");
  });

  it("puts the plain medicine first and leaves out matches inside a word", () => {
    expect(rankDrugNames(LIST, "lisin")).toEqual(["Lisinopril", "Lisinopril anhydrous", "Hydrochlorothiazide / lisinopril"]);
    expect(rankDrugNames(LIST, "metf")[0]).toBe("Metformin");
    expect(rankDrugNames(LIST, "asp")).toEqual(["Aspirin", "Aspirin / caffeine"]);
  });

  it("needs two letters and caps the list", () => {
    expect(rankDrugNames(LIST, "l")).toEqual([]);
    expect(rankDrugNames(LIST, "a", 1)).toEqual([]);
    expect(rankDrugNames(LIST, "me", 2)).toHaveLength(2);
  });
});
