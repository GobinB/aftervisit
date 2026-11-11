import { describe, expect, it } from "vitest";
import { mailtoHref, presetFor, shareMessage, smsHref } from "@/lib/share-message";

const details = { name: "Sam Rivera", personName: "Margaret", url: "https://allhandscare.org/i/abcdefghijklmnopqrstuvwx#k=xyz" };

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

  it("says the link is new after a visit, with no health details", () => {
    const { subject, body } = shareMessage({ ...details, pin: "4821", afterVisit: true });
    expect(subject).toBe("Margaret's care circle: new after a visit");
    expect(body).toContain("after a visit");
    expect(body).toContain("Your old link no longer works.");
    expect(body).toContain(details.url);
    expect(body).toContain("Your PIN is 4821.");
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
