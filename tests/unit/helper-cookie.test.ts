import { describe, expect, test } from "vitest";
import { linkTag, readHelperCookie, sameLink, signHelperCookie, type HelperClaim } from "@/lib/helper-cookie";

const secret = "test-helper-secret";
const other = "other-secret";

const lisa: HelperClaim = {
  memberId: "33333333-3333-4333-8333-333333333301",
  circleId: "22222222-2222-4222-8222-222222222222",
  role: "family",
  link: "a1b2c3d4e5f6a7b8",
};
const rosa: HelperClaim = {
  memberId: "33333333-3333-4333-8333-333333333302",
  circleId: "44444444-4444-4444-8444-444444444444",
  role: "home_aide",
  link: "0f1e2d3c4b5a6978",
};

describe("helper session cookie", () => {
  test("round-trips several circles", () => {
    const token = signHelperCookie([lisa, rosa], secret);
    expect(readHelperCookie(token, secret)).toEqual([lisa, rosa]);
  });

  test("a flipped character or the wrong secret reads as no session", () => {
    const token = signHelperCookie([lisa], secret);
    const flipped = `${token.slice(0, -1)}${token.endsWith("a") ? "b" : "a"}`;
    expect(readHelperCookie(flipped, secret)).toEqual([]);
    expect(readHelperCookie(token, other)).toEqual([]);
    expect(readHelperCookie(undefined, secret)).toEqual([]);
    expect(readHelperCookie(token, "")).toEqual([]);
  });

  test("a cookie with a role outside the list is ignored", () => {
    const token = signHelperCookie([lisa], secret);
    const body = token.slice(0, token.lastIndexOf("."));
    const forged = Buffer.from(JSON.stringify([{ ...lisa, role: "owner" }])).toString("base64url");
    expect(forged).not.toBe(body);
    expect(readHelperCookie(`${forged}.${token.slice(token.lastIndexOf(".") + 1)}`, secret)).toEqual([]);
  });

  test("a cookie from before links were tracked reads as no session", () => {
    const old = Buffer.from(JSON.stringify([{ memberId: lisa.memberId, circleId: lisa.circleId, role: "family" }])).toString("base64url");
    const token = signHelperCookie([lisa], secret).replace(/^[^.]+/, old);
    expect(readHelperCookie(token, secret)).toEqual([]);
  });

  test("only a cookie made from the current link matches", () => {
    const hash = "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6";
    expect(linkTag(hash)).toBe("a1b2c3d4e5f6a7b8");
    expect(sameLink(lisa.link, hash)).toBe(true);
    expect(sameLink(lisa.link, "ffffffffffffffffc9d0e1f2a3b4c5d6")).toBe(false);
    expect(sameLink(lisa.link, null)).toBe(false);
  });
});
