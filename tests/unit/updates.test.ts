import { describe, expect, test } from "vitest";
import { whoNeedsUpdate, type HelperForUpdates } from "@/lib/updates";

const circleId = "22222222-2222-4222-8222-222222222222";
const at = (minute: number) => new Date(Date.UTC(2026, 10, 14, 12, minute)).toISOString();

function helper(over: Partial<HelperForUpdates>): HelperForUpdates {
  return { id: "m1", circleId, name: "Rosa Diaz", role: "family", visibility: {}, lastSeenAt: null, lastToldAt: null, linkIssuedAt: at(0), ...over };
}

describe("who has not heard about a change", () => {
  test("a person who can see the area and has not opened their link since is listed, with what changed", () => {
    const pending = whoNeedsUpdate([{ area: "medications", changedAt: at(10) }, { area: "calendar", changedAt: at(11) }], [helper({})]);
    expect(pending).toEqual([{ memberId: "m1", name: "Rosa Diaz", areas: ["medications", "calendar"] }]);
  });

  test("opening the link, being sent it, or being given it after the change all count as heard", () => {
    const updates = [{ area: "medications" as const, changedAt: at(10) }];
    expect(whoNeedsUpdate(updates, [helper({ lastSeenAt: at(11) })])).toEqual([]);
    expect(whoNeedsUpdate(updates, [helper({ lastToldAt: at(11) })])).toEqual([]);
    expect(whoNeedsUpdate(updates, [helper({ linkIssuedAt: at(11) })])).toEqual([]);
    expect(whoNeedsUpdate(updates, [helper({ lastSeenAt: at(9) })])).toHaveLength(1);
  });

  test("a change in an area the person cannot see is not theirs to hear about", () => {
    const updates = [{ area: "summary" as const, changedAt: at(10) }, { area: "medications" as const, changedAt: at(10) }];
    // Areas the caregiver hid from this person.
    expect(whoNeedsUpdate(updates, [helper({ visibility: { hidden: ["medications"] } })])).toEqual([{ memberId: "m1", name: "Rosa Diaz", areas: ["summary"] }]);
    expect(whoNeedsUpdate(updates, [helper({ visibility: { hidden: ["medications", "summary"] } })])).toEqual([]);
  });

  test("reminders count for a home aide, who sees their own", () => {
    expect(whoNeedsUpdate([{ area: "tasks", changedAt: at(10) }], [helper({ role: "day_program" })])).toHaveLength(1);
  });

  test("nothing changed, nobody listed", () => {
    expect(whoNeedsUpdate([], [helper({})])).toEqual([]);
  });
});
