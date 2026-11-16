import { describe, expect, test } from "vitest";
import { isTimeZone, todayIn, zonedToUtc } from "@/lib/time-zone";

describe("time zones", () => {
  test("today is the date where the person lives, not on the server", () => {
    // 01:30 UTC on Nov 16 is still the evening of Nov 15 in Kentucky.
    const late = new Date("2026-11-16T01:30:00Z");
    expect(todayIn("America/New_York", late)).toBe("2026-11-15");
    expect(todayIn("Asia/Tokyo", late)).toBe("2026-11-16");
    expect(todayIn(null, late)).toBe("2026-11-16");
  });

  test("a wall-clock time becomes the right instant, on both sides of a clock change", () => {
    expect(zonedToUtc("2026-03-07", "07:00", "America/New_York").toISOString()).toBe("2026-03-07T12:00:00.000Z");
    expect(zonedToUtc("2026-03-08", "07:00", "America/New_York").toISOString()).toBe("2026-03-08T11:00:00.000Z");
    expect(zonedToUtc("2026-11-01", "07:00", "America/New_York").toISOString()).toBe("2026-11-01T12:00:00.000Z");
    expect(zonedToUtc("2026-11-17", "23:59:59", "America/New_York").toISOString()).toBe("2026-11-18T04:59:59.000Z");
  });

  test("only real zones are accepted", () => {
    expect(isTimeZone("America/New_York")).toBe(true);
    expect(isTimeZone("America/Kentucky/Louisville")).toBe(true);
    expect(isTimeZone("Not/AZone")).toBe(false);
    expect(isTimeZone("America/New_York; DROP")).toBe(false);
    expect(isTimeZone("")).toBe(false);
  });
});
