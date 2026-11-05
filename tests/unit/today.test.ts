import { describe, expect, test } from "vitest";
import type { PersonView } from "@/lib/schema/circles";
import { buildAlerts, buildFeed, buildStats, type ActivityRow } from "@/lib/today";

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
  test("stats count only links that still work", () => {
    const stats = Object.fromEntries(buildStats(CIRCLE, people, { person_name: "M", allergies: ["Penicillin"], doctors: [], emergency_contacts: [] }, NOW).map((s) => [s.key, s]));
    expect(stats.helpers.value).toBe(3);
    expect(stats.opened.value).toBe(1);
    expect(stats.opened.detail).toBe("of 3");
    expect(stats.waiting.value).toBe(1);
    expect(stats.waiting.tone).toBe("amber");
    expect(stats.allergies.value).toBe(1);
    expect(stats.allergies.detail).toBe("Penicillin");
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
