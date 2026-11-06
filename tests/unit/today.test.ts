import { describe, expect, test } from "vitest";
import type { PersonView } from "@/lib/schema/circles";
import { buildAlerts, buildFeed, buildTodayCards, missingDetails, type ActivityRow } from "@/lib/today";

const NOW = Date.UTC(2026, 10, 3, 12, 0);
const ago = (days: number) => new Date(NOW - days * 86_400_000).toISOString();
const CIRCLE = "c1";

const people: PersonView[] = [
  { id: "owner", name: "Lisa", role: "owner", roleLabel: "Caregiver", kind: "caregiver" },
  { id: "rosa", name: "Rosa", role: "home_aide", roleLabel: "Home aide", kind: "member", lastSeenAt: ago(1), expiresAt: ago(-60) },
  { id: "dana", name: "Dana", role: "care_manager", roleLabel: "Care manager", kind: "member", lastSeenAt: ago(10), expiresAt: ago(-5), locked: true },
  { id: "sun", name: "Sunrise", role: "day_program", roleLabel: "Day program", kind: "member", lastSeenAt: null, expiresAt: ago(-80) },
  { id: "old", name: "Old link", role: "family", roleLabel: "Family", kind: "member", lastSeenAt: ago(0), revokedAt: ago(2) },
];

describe("Today", () => {
  test("cards put scanning first, then medications, reminders and allergies", () => {
    const content = { person_name: "M", allergies: ["Penicillin"], doctors: [], emergency_contacts: [] };
    const meds = [
      { name: "Lisinopril", status: "active" },
      { name: "Metformin", status: "active" },
      { name: "Warfarin", status: "stopped" },
    ];
    const cards = buildTodayCards(CIRCLE, content, meds, []);
    expect(cards.map((c) => c.key)).toEqual(["scan", "meds", "reminders", "allergies"]);
    const byKey = Object.fromEntries(cards.map((c) => [c.key, c]));
    expect(byKey.scan.label).toBe("Scan after-visit summary");
    expect(byKey.scan.href).toBe(`/new?circle=${CIRCLE}`);
    expect(byKey.meds.value).toBe(2);
    expect(byKey.meds.detail).toBe("Lisinopril, Metformin");
    expect(byKey.allergies.value).toBe(1);
    expect(byKey.allergies.detail).toBe("Penicillin");
    expect(byKey.allergies.href).toBe(`/circles/${CIRCLE}/summary`);
  });

  test("empty cards lead to the form that adds the first entry", () => {
    const cards = Object.fromEntries(buildTodayCards(CIRCLE, { person_name: "M", allergies: [], doctors: [], emergency_contacts: [] }, [], []).map((c) => [c.key, c]));
    expect(cards.meds.href).toBe(`/circles/${CIRCLE}/medications/new`);
    expect(cards.allergies.href).toBe(`/circles/${CIRCLE}/summary/edit?part=allergies`);
    expect(cards.allergies.detail).toBe("Tap to add");
  });

  test("details still missing are offered as optional cards", () => {
    const keys = (content: Parameters<typeof missingDetails>[1]) => missingDetails(CIRCLE, content).map((item) => item.key);
    expect(keys({ person_name: "M", allergies: [], doctors: [], emergency_contacts: [] })).toEqual(["doctors", "contacts", "pharmacy"]);
    expect(
      keys({ person_name: "M", allergies: [], doctors: [{ name: "Dr. Patel" }], emergency_contacts: [{ name: "Anna" }], pharmacy: { name: "Main Street" } }),
    ).toEqual([]);
    expect(missingDetails(CIRCLE, null)).toEqual([]);
  });

  test("the feed names people, adds link opens, skips unknown actions, newest first", () => {
    const rows: ActivityRow[] = [
      { id: "a1", action: "member_added", subjectId: "sun", at: ago(3) },
      { id: "a2", action: "circle_created", subjectId: "c1", at: ago(20) },
      { id: "a3", action: "something_new", subjectId: null, at: ago(0.5) },
      { id: "a4", action: "member_revoked", subjectId: "old", at: ago(2) },
    ];
    const feed = buildFeed(rows, people);
    expect(feed.map((item) => item.title)).toEqual([
      "Rosa opened their link",
      "Old link's link turned off",
      "Sunrise added",
      "Dana opened their link",
      "Circle started",
    ]);
    expect(feed.some((item) => item.title.startsWith("Old link opened"))).toBe(false);
  });

  test("alerts list only what needs the caregiver", () => {
    const alerts = Object.fromEntries(buildAlerts(CIRCLE, people, NOW).map((a) => [a.key, a.count]));
    expect(alerts).toEqual({ locked: 1, unopened: 1, expiring: 1 });
    expect(buildAlerts(CIRCLE, [people[0]], NOW)).toEqual([]);
  });
});
