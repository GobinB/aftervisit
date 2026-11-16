import { describe, expect, it } from "vitest";
import { assignedMessage, assignedSummary, mailtoHref, presetFor, shareMessage, smsHref, smsTo, whenText } from "@/lib/share-message";

const details = { name: "Sam Rivera", personName: "Margaret", url: "https://allhandscare.org/i/abcdefghijklmnopqrstuvwx" };

describe("share message", () => {
  it("greets by first name and includes the link", () => {
    const { subject, body } = shareMessage(details);
    expect(subject).toBe("Margaret's care circle");
    expect(body).toContain("Hi Sam,");
    expect(body).toContain(details.url);
    expect(body).not.toContain("PIN");
  });

  it("includes the PIN when there is one", () => {
    expect(shareMessage({ ...details, pin: "4821" }).body).toContain("Your PIN is 4821.");
  });

  it("after a change, says what changed and that the link is the same, with no health details", () => {
    const { subject, body } = shareMessage({ ...details, changed: "medicines and the calendar" });
    expect(subject).toBe("Margaret's care circle: medicines and the calendar changed");
    expect(body).toContain("medicines and the calendar changed");
    expect(body).toContain("same link as before");
    expect(body).not.toContain("no longer works");
    expect(body).toContain(details.url);
    expect(body).not.toMatch(/metformin|mg\b/i);
  });

  it("reminds a person of their PIN without showing it, when the same link is shared again", () => {
    const { body } = shareMessage({ ...details, hasPin: true, changed: "reminders" });
    expect(body).toContain("Use the same PIN as before.");
    expect(body).not.toMatch(/PIN is \d/);
  });

  it("builds mailto and sms links with the message filled in", () => {
    const mail = mailtoHref("sam@example.com", { ...details, pin: "4821" });
    expect(mail.startsWith("mailto:sam%40example.com?subject=")).toBe(true);
    expect(decodeURIComponent(mail)).toContain("Your PIN is 4821.");
    expect(mailtoHref(null, details).startsWith("mailto:?subject=")).toBe(true);
    const sms = smsHref(details);
    expect(sms.startsWith("sms:?&body=")).toBe(true);
    expect(decodeURIComponent(sms.slice("sms:?&body=".length))).toContain(details.url);
  });

  it("matches what a person sees to a preset", () => {
    expect(presetFor([])).toBe("everything");
    expect(presetFor(["summary", "medications", "handoff"])).toBe("calendar");
    expect(presetFor(["medications"])).toBe("custom");
  });
});

describe("the text after a visit puts someone down for something", () => {
  const url = "https://allhandscare.org/i/abcdefghijklmnopqrstuvwx";
  const assigned = { appointments: [{ date: "2026-11-24", time: "10:30" }], reminders: 2 };

  it("says the day and time in plain words", () => {
    expect(whenText("2026-11-24", "10:30")).toBe("Tuesday, November 24 at 10:30 AM");
    expect(whenText("2026-11-24", "00:05")).toBe("Tuesday, November 24 at 12:05 AM");
    expect(whenText("2026-11-24", "13:00")).toBe("Tuesday, November 24 at 1:00 PM");
    expect(whenText("2026-11-24")).toBe("Tuesday, November 24");
  });

  it("welcomes someone new with what they are down for and their link, and no health details", () => {
    const body = assignedMessage({ name: "Anna Lee", personName: "Margaret", url, isNew: true, assigned });
    expect(body).toContain("Hi Anna,");
    expect(body).toContain("I added you to Margaret's care circle");
    expect(body).toContain("- Going with Margaret to an appointment on Tuesday, November 24 at 10:30 AM");
    expect(body).toContain("- 2 reminders to take care of");
    expect(body).toContain(url);
    expect(body).toContain("No account or password needed");
    expect(body).not.toMatch(/cardio|metformin|mg\b|PIN/i);
  });

  it("tells someone already in the circle it is the same link, and reminds them of a PIN", () => {
    const body = assignedMessage({ name: "Sam", personName: "Margaret", url, isNew: false, hasPin: true, assigned: { appointments: [], reminders: 1 } });
    expect(body).toContain("I updated Margaret's care circle");
    expect(body).toContain("- 1 reminder to take care of");
    expect(body).toContain("same link as before");
    expect(body).toContain("Use the same PIN as before.");
    expect(body).not.toContain("Home Screen");
  });

  it("someone added with nothing to do yet still gets their link", () => {
    const body = assignedMessage({ name: "Joy", personName: "Margaret", url, isNew: true, assigned: { appointments: [], reminders: 0 } });
    expect(body).toContain("I added you to Margaret's care circle on All Hands Care. This is your own link.");
    expect(body).not.toContain("put you down");
  });

  it("sums it up for the caregiver's screen", () => {
    expect(assignedSummary(assigned)).toBe("Going to 1 appointment · 2 reminders");
    expect(assignedSummary({ appointments: [], reminders: 1 })).toBe("1 reminder");
    expect(assignedSummary({ appointments: [], reminders: 0 })).toBe("");
  });

  it("texts the number when there is one, and lets the caregiver pick when there is not", () => {
    expect(smsTo("(555) 010-0142", "Hi")).toBe("sms:5550100142?&body=Hi");
    expect(smsTo("+1 555 010 0142", "Hi")).toBe("sms:+15550100142?&body=Hi");
    expect(smsTo(null, "Hi there")).toBe("sms:?&body=Hi%20there");
  });
});
