import { describe, expect, it } from "vitest";
import { HOW_OFTEN, eventSuggestions, howOftenKey } from "@/lib/suggestions";

describe("tap-to-pick suggestions", () => {
  it("each how-often choice is recognised again from what it sets", () => {
    for (const item of HOW_OFTEN) expect(howOftenKey(item.schedule, item.times)).toBe(item.key);
    expect(howOftenKey("daily", ["07:30"])).toBeNull();
    expect(howOftenKey("weekdays", ["08:00"])).toBeNull();
  });

  it("suggests events with the circle's own doctors first", () => {
    const list = eventSuggestions([{ name: "Dr. Natarajan", specialty: "Cardiology" }, { name: "Dr. Lee" }]);
    expect(list.slice(0, 2)).toEqual(["Cardiology appointment with Dr. Natarajan", "Appointment with Dr. Lee"]);
    expect(list).toContain("Blood work");
    expect(eventSuggestions([])[0]).toBe("Doctor appointment");
  });
});
