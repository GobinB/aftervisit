import { describe, expect, it } from "vitest";
import { buildCalendar, escapeText, type FeedMedicine, foldLine, medicineLines, subscribeLinks } from "@/lib/ics";
import { medsOnDay } from "@/lib/med-days";
import type { CareEvent } from "@/lib/schema/events";
import type { Medication } from "@/lib/schema/medications";

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
    expect(escapeText("Dr. Lee, 2nd floor; bring list\nand card \\ ok")).toBe("Dr. Lee\\, 2nd floor\\; bring list\\nand card \\\\ ok");
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

const med = (over: Partial<Medication>): Medication => ({
  id: "med1",
  name: "Lisinopril",
  dose: "10 mg",
  amount: "1 tablet",
  form: null,
  schedule: "daily",
  every: null,
  weekdays: [],
  times: ["08:00"],
  startDate: "2026-11-02",
  stopDate: null,
  status: "active",
  reason: "Blood pressure",
  instructions: "Take with food",
  prescriber: "Dr. Example",
  refillsLeft: 2,
  lastRefill: null,
  source: "caregiver",
  updatedAt: "2026-11-01T10:00:00Z",
  ...over,
});

/** The entries for one medicine, unfolded and split into one list of lines per VEVENT. */
function entries(m: FeedMedicine): Map<string, string>[] {
  const out: Map<string, string>[] = [];
  let current: Map<string, string> | null = null;
  for (const line of medicineLines(m, "allhandscare.org", NOW)) {
    if (line === "BEGIN:VEVENT") current = new Map();
    else if (line === "END:VEVENT" && current) out.push(current);
    else if (current) {
      const at = line.indexOf(":");
      current.set(line.slice(0, at), line.slice(at + 1));
    }
  }
  return out;
}

const iso = (ics: string) => `${ics.slice(0, 4)}-${ics.slice(4, 6)}-${ics.slice(6, 8)}`;
const plus = (day: string, n: number) => {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const BYDAY = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

/**
 * The days an entry falls on between two dates, as a calendar app reads its RRULE. Covers what the
 * file uses: DAILY, WEEKLY (with BYDAY) and MONTHLY, INTERVAL and UNTIL.
 */
function daysOf(entry: Map<string, string>, from: string, to: string): string[] {
  const start = iso((entry.get("DTSTART") ?? entry.get("DTSTART;VALUE=DATE")) as string);
  const rule = Object.fromEntries((entry.get("RRULE") as string).split(";").map((part) => part.split("=")));
  const interval = Number(rule.INTERVAL ?? 1);
  const until = rule.UNTIL ? iso(rule.UNTIL) : "9999-12-31";
  const byday = rule.BYDAY ? rule.BYDAY.split(",").map((code: string) => BYDAY.indexOf(code)) : null;
  const weekStart = (day: string) => plus(day, -new Date(`${day}T12:00:00Z`).getUTCDay());
  const out: string[] = [];
  for (let day = start; day <= to && day <= until; day = plus(day, 1)) {
    const days = Math.round((Date.parse(day) - Date.parse(start)) / 86_400_000);
    let on = false;
    if (rule.FREQ === "DAILY") on = days % interval === 0;
    if (rule.FREQ === "WEEKLY") {
      const weeks = Math.round((Date.parse(weekStart(day)) - Date.parse(weekStart(start))) / (7 * 86_400_000));
      on = weeks % interval === 0 && (byday ? byday.includes(new Date(`${day}T12:00:00Z`).getUTCDay()) : days % 7 === 0);
    }
    if (rule.FREQ === "MONTHLY") {
      const months = (Number(day.slice(0, 4)) - Number(start.slice(0, 4))) * 12 + Number(day.slice(5, 7)) - Number(start.slice(5, 7));
      on = months % interval === 0 && day.slice(8, 10) === start.slice(8, 10);
    }
    // RFC 5545: the first entry always counts, even when it does not fit the rule.
    if (day === start) on = true;
    if (on && day >= from) out.push(day);
  }
  return out;
}

/** The days the Calendar page shows the medicine, over the same range. */
function pageDays(m: Medication, from: string, to: string): string[] {
  const out: string[] = [];
  for (let day = from; day <= to; day = plus(day, 1)) if (medsOnDay([m], day).length) out.push(day);
  return out;
}

describe("medicines in the calendar link", () => {
  const FROM = "2026-11-02";
  const TO = "2027-06-30";

  it.each([
    ["every day", med({})],
    ["certain days of the week", med({ schedule: "weekdays", weekdays: [1, 3, 5], startDate: "2026-11-04" })],
    ["weekdays starting on a day that is not one of them", med({ schedule: "weekdays", weekdays: [2, 6], startDate: "2026-11-02" })],
    ["every 3 days", med({ schedule: "every_x_days", every: 3, startDate: "2026-11-05" })],
    ["every 2 weeks", med({ schedule: "every_x_weeks", every: 2, startDate: "2026-11-06" })],
    ["every week", med({ schedule: "every_x_weeks", every: 1 })],
    ["every month", med({ schedule: "every_x_months", every: 1, startDate: "2026-11-10" })],
    ["every 3 months", med({ schedule: "every_x_months", every: 3, startDate: "2026-11-15" })],
    ["every month on the 31st (skips shorter months)", med({ schedule: "every_x_months", every: 1, startDate: "2026-12-31" })],
    ["no start date (counts from the last change)", med({ schedule: "every_x_days", every: 2, startDate: null, updatedAt: "2026-11-09T18:00:00Z" })],
    ["stopped, with a stop date", med({ status: "stopped", stopDate: "2027-01-20" })],
    ["stopped, every 2 weeks", med({ schedule: "every_x_weeks", every: 2, status: "stopped", stopDate: "2027-02-04" })],
  ])("repeats on the same days the Calendar page shows: %s", (_label, m) => {
    const list = entries(m);
    expect(list).toHaveLength(m.times.length);
    // From the first day the file can show (no start date: the day it was last changed).
    const from = m.startDate ?? m.updatedAt.slice(0, 10);
    for (const entry of list) expect(daysOf(entry, from < FROM ? FROM : from, TO)).toEqual(pageDays(m, from < FROM ? FROM : from, TO));
  });

  it("writes one entry per time of day, at the circle's wall-clock time, out of the way of busy time", () => {
    const list = entries(med({ times: ["20:00", "08:00"] }));
    expect(list.map((e) => e.get("UID"))).toEqual(["med-med1-0800@allhandscare.org", "med-med1-2000@allhandscare.org"]);
    // Floating times, like appointments: no Z and no time zone, so 8 AM shows at 8 AM.
    expect(list[0].get("DTSTART")).toBe("20261102T080000");
    expect(list[0].get("DTEND")).toBe("20261102T081500");
    expect(list[1].get("DTSTART")).toBe("20261102T200000");
    expect(list[0].get("RRULE")).toBe("FREQ=DAILY");
    expect(list[0].get("SUMMARY")).toBe("Lisinopril · 10 mg · 1 tablet");
    expect(list[0].get("DESCRIPTION")).toBe("Every day at 8 AM and 8 PM");
    expect(list[0].get("TRANSP")).toBe("TRANSPARENT");
    expect(list[0].get("LAST-MODIFIED")).toBe("20261101T100000Z");
  });

  it("sends only the name, strength and times: not the reason, instructions or prescriber", () => {
    const text = medicineLines(med({}), "allhandscare.org", NOW).join("\n");
    expect(text).not.toContain("Blood pressure");
    expect(text).not.toContain("Take with food");
    expect(text).not.toContain("Dr. Example");
  });

  it("writes the repeat rule for each schedule", () => {
    const rule = (over: Partial<Medication>) => entries(med(over))[0].get("RRULE");
    expect(rule({ schedule: "every_x_days", every: 1 })).toBe("FREQ=DAILY");
    expect(rule({ schedule: "every_x_days", every: 3 })).toBe("FREQ=DAILY;INTERVAL=3");
    expect(rule({ schedule: "weekdays", weekdays: [5, 1, 3, 1] })).toBe("FREQ=WEEKLY;BYDAY=MO,WE,FR");
    expect(rule({ schedule: "every_x_weeks", every: 2 })).toBe("FREQ=WEEKLY;INTERVAL=2");
    expect(rule({ schedule: "every_x_months", every: 6 })).toBe("FREQ=MONTHLY;INTERVAL=6");
  });

  it("starts certain-days medicines on the first of those days", () => {
    // November 2, 2026 is a Monday; Tuesday and Saturday only.
    expect(entries(med({ schedule: "weekdays", weekdays: [2, 6] }))[0].get("DTSTART")).toBe("20261103T080000");
  });

  it("ends a stopped medicine the day before it was stopped, and leaves out one that never started", () => {
    expect(entries(med({ status: "stopped", stopDate: "2026-11-20" }))[0].get("RRULE")).toBe("FREQ=DAILY;UNTIL=20261119T235959");
    expect(medicineLines(med({ status: "stopped", stopDate: "2026-11-02" }), "h", NOW)).toEqual([]);
    expect(medicineLines(med({ status: "stopped", stopDate: null }), "h", NOW)).toEqual([]);
  });

  it("leaves out medicines taken only when needed", () => {
    expect(medicineLines(med({ schedule: "as_needed", times: [] }), "h", NOW)).toEqual([]);
    expect(medicineLines(med({ schedule: "as_needed", times: ["08:00"] }), "h", NOW)).toEqual([]);
  });

  it("puts a scheduled medicine with no time of day on its days as an all-day entry", () => {
    const [entry] = entries(med({ times: [], schedule: "weekdays", weekdays: [1], status: "stopped", stopDate: "2026-12-01" }));
    expect(entry.get("UID")).toBe("med-med1@allhandscare.org");
    expect(entry.get("DTSTART;VALUE=DATE")).toBe("20261102");
    expect(entry.get("DTEND;VALUE=DATE")).toBe("20261103");
    expect(entry.get("RRULE")).toBe("FREQ=WEEKLY;BYDAY=MO;UNTIL=20261130");
  });

  it("carries a late dose past midnight without going backwards", () => {
    const [entry] = entries(med({ times: ["23:50"] }));
    expect(entry.get("DTSTART")).toBe("20261102T235000");
    expect(entry.get("DTEND")).toBe("20261103T000500");
  });

  it("escapes and folds long medicine text", () => {
    const m = med({ name: "Amoxicillin; clavulanate, extended release \\ chewable", dose: "875 mg/125 mg", amount: "1 tablet, twice\nwith water" });
    const ics = buildCalendar({ name: "Rosa Delgado's care", events: [], reminders: [], medicines: [m], goingName: () => null, host: "allhandscare.org", now: NOW });
    const lines = ics.split("\r\n");
    expect(lines.every((line) => new TextEncoder().encode(line).length <= 75)).toBe(true);
    const unfolded = ics.replace(/\r\n /g, "");
    expect(unfolded).toContain(
      "SUMMARY:Amoxicillin\\; clavulanate\\, extended release \\\\ chewable · 875 mg/125 mg · 1 tablet\\, twice\\nwith water\r\n",
    );
  });

  it("adds medicines to the file only when given, so the switch can leave them out", () => {
    const withMeds = buildCalendar({ name: "Care", events: [], reminders: [], medicines: [med({})], goingName: () => null, host: "h", now: NOW });
    const without = buildCalendar({ name: "Care", events: [], reminders: [], goingName: () => null, host: "h", now: NOW });
    expect(withMeds).toContain("UID:med-med1-0800@h");
    expect(without).not.toContain("med-");
    expect(without).not.toContain("Lisinopril");
  });
});
