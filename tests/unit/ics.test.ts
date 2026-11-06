import { describe, expect, it } from "vitest";
import { buildCalendar, escapeText, foldLine, subscribeLinks } from "@/lib/ics";
import type { CareEvent } from "@/lib/schema/events";

const event = (over: Partial<CareEvent>): CareEvent => ({
  id: "ev1",
  title: "Physical therapy",
  date: "2026-11-17",
  startTime: "09:00",
  endTime: "10:00",
  location: null,
  notes: null,
  repeat: "none",
  repeatUntil: null,
  going: null,
  needsVolunteer: false,
  ...over,
});

const NOW = new Date("2026-11-06T15:30:00Z");
const build = (events: CareEvent[], reminders = [] as { id: string; title: string; dueDate: string; who: string | null }[]) =>
  buildCalendar({ name: "Rosa Delgado's care", events, reminders, goingName: (e) => (e.going ? "Sam" : null), host: "allhandscare.org", now: NOW });

describe("calendar link file", () => {
  it("escapes text and folds long lines", () => {
    expect(escapeText("Dr. Lee, 2nd floor; bring list\nand card \\ ok")).toBe("Dr. Lee\\, 2nd floor\; bring list\\nand card \\\\ ok");
    const long = `SUMMARY:${"a".repeat(100)}`;
    const folded = foldLine(long);
    expect(folded.split("\r\n ").every((part) => new TextEncoder().encode(part).length <= 75)).toBe(true);
    expect(folded.replace(/\r\n /g, "")).toBe(long);
    expect(foldLine(`X:${"é".repeat(60)}`).replace(/\r\n /g, "")).toBe(`X:${"é".repeat(60)}`);
  });

  it("writes timed, all-day and repeating appointments in local wall-clock time", () => {
    const ics = build([
      event({ location: "Riverbend Rehab, Room 2", notes: "Bring shoes", going: { kind: "caregiver" } }),
      event({ id: "ev2", title: "Cardiology", startTime: "10:30", endTime: null, needsVolunteer: true }),
      event({ id: "ev3", title: "Birthday", startTime: null, endTime: null, date: "2026-11-18", repeat: "yearly" }),
      event({ id: "ev4", title: "Walk", repeat: "every_2_weeks", repeatUntil: "2026-12-31" }),
    ]);
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("X-WR-CALNAME:Rosa Delgado's care");
    expect(ics).toContain("UID:ev1@allhandscare.org\r\nDTSTAMP:20261106T153000Z\r\nDTSTART:20261117T090000\r\nDTEND:20261117T100000");
    expect(ics).toContain("LOCATION:Riverbend Rehab\\, Room 2");
    expect(ics).toContain("DESCRIPTION:Sam is going.\\nBring shoes");
    expect(ics).toContain("DTSTART:20261117T103000\r\nDTEND:20261117T113000");
    expect(ics).toContain("DESCRIPTION:Needs someone to go.");
    expect(ics).toContain("DTSTART;VALUE=DATE:20261118\r\nDTEND;VALUE=DATE:20261119\r\nRRULE:FREQ=YEARLY");
    expect(ics).toContain("RRULE:FREQ=WEEKLY;INTERVAL=2;UNTIL=20261231T235959");
  });

  it("adds due reminders as all-day entries", () => {
    const ics = build([], [{ id: "t1", title: "Pick up prescription", dueDate: "2026-11-19", who: "Sam" }]);
    expect(ics).toContain("UID:reminder-t1@allhandscare.org");
    expect(ics).toContain("SUMMARY:Reminder: Pick up prescription");
    expect(ics).toContain("DESCRIPTION:Sam is doing this.");
  });

  it("makes subscribe links for each calendar app", () => {
    const links = subscribeLinks("https://www.allhandscare.org/api/calendar/abc.ics", "Rosa's care");
    expect(links.apple).toBe("webcal://www.allhandscare.org/api/calendar/abc.ics");
    expect(links.google).toBe("https://calendar.google.com/calendar/render?cid=webcal%3A%2F%2Fwww.allhandscare.org%2Fapi%2Fcalendar%2Fabc.ics");
    expect(links.outlook).toContain("addfromweb?url=https%3A%2F%2Fwww.allhandscare.org");
  });
});
