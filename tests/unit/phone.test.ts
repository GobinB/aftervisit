import { describe, expect, test } from "vitest";
import { AddMemberSchema, SetMemberPhoneSchema, SetOwnPhoneSchema } from "@/lib/schema/circles";
import { cleanPhone, PHONE_HINT, telHref } from "@/lib/phone";

const CIRCLE = "22222222-2222-4222-8222-222222222222";
const MEMBER = "44444444-4444-4444-8444-444444444444";

describe("phone numbers", () => {
  test("kept as typed, trimmed, with spaces tidied", () => {
    expect(cleanPhone("  (555) 010-0142 ")).toEqual({ ok: true, phone: "(555) 010-0142" });
    expect(cleanPhone("555.010.0142")).toEqual({ ok: true, phone: "555.010.0142" });
    expect(cleanPhone("+1 555  010 0142")).toEqual({ ok: true, phone: "+1 555 010 0142" });
  });

  test("blank means no number", () => {
    expect(cleanPhone("")).toEqual({ ok: true, phone: null });
    expect(cleanPhone("   ")).toEqual({ ok: true, phone: null });
    expect(cleanPhone(null)).toEqual({ ok: true, phone: null });
  });

  test("anything that is not a phone number gets a plain message", () => {
    for (const bad of ["12", "call me", "555-010-0142 cell", "1234567890123456", "555+010+0142", "<b>5550100142</b>"]) {
      expect(cleanPhone(bad), bad).toEqual({ ok: false, error: PHONE_HINT });
    }
  });

  test("tap to call dials the digits, keeping a leading +", () => {
    expect(telHref("(555) 010-0142")).toBe("tel:5550100142");
    expect(telHref("+1 555 010 0142")).toBe("tel:+15550100142");
    expect(telHref("911")).toBe("tel:911");
  });

  test("the care summary's free text: the first number in it is dialed, no number means no button", () => {
    expect(telHref("555-010-0177 (cell)")).toBe("tel:5550100177");
    expect(telHref("cell: 555 010 0177, work 555 010 0100")).toBe("tel:5550100177");
    expect(telHref("ask the front desk")).toBeNull();
    expect(telHref("")).toBeNull();
    expect(telHref(null)).toBeNull();
  });

  test("forms accept a number or blank, and refuse anything else", () => {
    expect(SetOwnPhoneSchema.safeParse({ circleId: CIRCLE, phone: "555-010-0142" }).success).toBe(true);
    expect(SetOwnPhoneSchema.safeParse({ circleId: CIRCLE, phone: "" }).success).toBe(true);
    expect(SetOwnPhoneSchema.safeParse({ circleId: CIRCLE, phone: "nope" }).success).toBe(false);
    // A person can never pass someone else's member id to change their own number.
    expect(SetOwnPhoneSchema.safeParse({ circleId: CIRCLE, memberId: MEMBER, phone: "555-010-0142" }).success).toBe(false);
    expect(SetMemberPhoneSchema.safeParse({ circleId: CIRCLE, memberId: MEMBER, phone: "555-010-0142" }).success).toBe(true);
    expect(AddMemberSchema.safeParse({ circleId: CIRCLE, name: "Sam", role: "family", phone: "555-010-0142" }).success).toBe(true);
    expect(AddMemberSchema.safeParse({ circleId: CIRCLE, name: "Sam", role: "family" }).success).toBe(true);
    expect(AddMemberSchema.safeParse({ circleId: CIRCLE, name: "Sam", role: "family", phone: "x" }).success).toBe(false);
  });
});
