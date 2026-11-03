import { describe, expect, test } from "vitest";
import { safeNext } from "@/lib/safe-next";

const origin = "https://aftervisit.example";

describe("safeNext", () => {
  test("keeps a normal path on this site", () => {
    expect(safeNext("/circles/22222222-2222-4222-8222-222222222222/members", origin)).toBe(
      "/circles/22222222-2222-4222-8222-222222222222/members",
    );
    expect(safeNext("/circles?from=login", origin)).toBe("/circles?from=login");
  });

  test.each(["//evil.com", "/\\evil.com", "/%5Cevil.com", "https://evil.com", "/%2F%2Fevil.com"])(
    "rejects %s",
    (value) => {
      expect(safeNext(value, origin)).toBe("/circles");
    },
  );

  test("rejects a missing value and a control character", () => {
    expect(safeNext(undefined, origin)).toBe("/circles");
    expect(safeNext("/circles\n/evil.com", origin)).toBe("/circles");
  });
});
