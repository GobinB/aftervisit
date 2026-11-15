import { describe, expect, test } from "vitest";
import { canReadScan, CIRCLE_NOT_OPENED, scanCircleAnswered, scanCircleFrom, scanCircleHref, scanCircleId } from "@/lib/scan-circle";

const ID = "22222222-2222-4222-8222-222222222222";

describe("which circle a scan belongs to", () => {
  test("no circle in the address: a stand-alone handoff, Done works at once", () => {
    const state = scanCircleFrom("");
    expect(state).toEqual({ status: "none" });
    expect(canReadScan(state)).toBe(true);
    expect(scanCircleId(state)).toBeNull();
  });

  test("a circle in the address is taken at once, and Done waits for the lookup", () => {
    const state = scanCircleFrom(`?circle=${ID}`);
    expect(state).toEqual({ status: "loading", id: ID });
    expect(canReadScan(state)).toBe(false);
    expect(scanCircleHref(state)).toBe(`/circles/${ID}`);
    // Before the page has looked at the address at all, Done is off too.
    expect(canReadScan({ status: "checking" })).toBe(false);
  });

  test("once the circle answers, the visit goes to it", () => {
    const state = scanCircleAnswered(ID, { ok: true, personName: "Teodora Ruiz" });
    expect(canReadScan(state)).toBe(true);
    expect(scanCircleId(state)).toBe(ID);
  });

  test("a circle that cannot be opened never turns into a stand-alone handoff", () => {
    for (const state of [scanCircleAnswered(ID, { ok: false }), scanCircleAnswered(ID, null)]) {
      expect(state).toEqual({ status: "failed", id: ID, message: CIRCLE_NOT_OPENED });
      expect(canReadScan(state)).toBe(false);
      expect(scanCircleId(state)).toBeNull();
      expect(scanCircleHref(state)).toBe(`/circles/${ID}`);
    }
  });

  test("a malformed circle in the address fails at once", () => {
    const state = scanCircleFrom("?circle=not-a-circle");
    expect(state.status).toBe("failed");
    expect(canReadScan(state)).toBe(false);
    expect(scanCircleHref(state)).toBeNull();
    expect(scanCircleFrom("?circle=").status).toBe("failed");
  });
});
