import { describe, expect, it } from "vitest";
import { caregiverHome } from "@/lib/home-path";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

describe("caregiverHome", () => {
  it("opens the only circle", () => {
    expect(caregiverHome([A], undefined)).toBe(`/circles/${A}`);
  });
  it("opens the circle used last when there are several", () => {
    expect(caregiverHome([A, B], B)).toBe(`/circles/${B}`);
  });
  it("ignores a remembered circle the caregiver no longer has", () => {
    expect(caregiverHome([A, B], "33333333-3333-4333-8333-333333333333")).toBe("/circles");
    expect(caregiverHome([A], B)).toBe(`/circles/${A}`);
  });
  it("lists circles when there are none or several", () => {
    expect(caregiverHome([], undefined)).toBe("/circles");
    expect(caregiverHome([A, B], undefined)).toBe("/circles");
  });
});
