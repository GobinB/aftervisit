import { describe, expect, it } from "vitest";
import { mailtoHref, presetFor, shareMessage, smsHref } from "@/lib/share-message";

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
    expect(presetFor(["summary", "medications"])).toBe("calendar");
    expect(presetFor(["medications"])).toBe("custom");
  });
});
