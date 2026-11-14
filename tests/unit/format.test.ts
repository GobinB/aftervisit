import { describe, expect, it } from "vitest";
import { dateTime } from "@/lib/format";

describe("dateTime", () => {
  it("writes month, day and a 12-hour time with a plain space before AM or PM", () => {
    expect(dateTime("2026-11-14T11:40:00Z", "America/New_York")).toBe("Nov 14, 6:40 AM");
    expect(dateTime("2026-11-14T11:40:00Z", "UTC")).toBe("Nov 14, 11:40 AM");
  });

  it("handles noon, midnight and the afternoon", () => {
    expect(dateTime("2026-11-14T12:05:00Z", "UTC")).toBe("Nov 14, 12:05 PM");
    expect(dateTime("2026-11-14T00:00:00Z", "UTC")).toBe("Nov 14, 12:00 AM");
    expect(dateTime("2026-11-14T23:59:00Z", "UTC")).toBe("Nov 14, 11:59 PM");
  });

  it("moves to the right day in the time zone", () => {
    expect(dateTime("2026-01-01T03:00:00Z", "America/Los_Angeles")).toBe("Dec 31, 7:00 PM");
  });

  it("uses only plain ASCII spaces, never the narrow space some engines add", () => {
    expect(dateTime("2026-11-14T18:40:00Z", "UTC")).toMatch(/^[\x20-\x7e]+$/);
  });

  it("returns an empty string for a bad date", () => {
    expect(dateTime("not a date")).toBe("");
  });
});
