import type { CircleContent, PersonView } from "@/lib/schema/circles";

/** One row of the circle's activity table, as the Today screen reads it. */
export type ActivityRow = { id: string; action: string; subjectId: string | null; at: string };

export type Tone = "blue" | "green" | "amber" | "attn" | "neutral";

export type FeedItem = { id: string; title: string; detail: string; at: string; tone: Tone };

export type Stat = { key: string; label: string; value: number; detail: string; tone: Tone; href?: string };

export type Alert = { key: string; label: string; count: number; tone: Tone; href: string };

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const EXPIRING_MS = 14 * 24 * 60 * 60 * 1000;

/** People who help through a link that still works. */
export function activeHelpers(people: PersonView[]): PersonView[] {
  return people.filter((person) => person.kind === "member" && !person.revokedAt);
}

const ACTIONS: Record<string, { title: (name: string) => string; tone: Tone }> = {
  circle_created: { title: () => "Circle started", tone: "blue" },
  member_added: { title: (name) => `${name} added`, tone: "blue" },
  member_link: { title: (name) => `New link for ${name}`, tone: "neutral" },
  member_renewed: { title: (name) => `${name}'s link renewed`, tone: "neutral" },
  member_role: { title: (name) => `${name}'s role changed`, tone: "neutral" },
  member_visibility: { title: (name) => `Changed what ${name} sees`, tone: "neutral" },
  member_revoked: { title: (name) => `${name}'s link turned off`, tone: "attn" },
  circle_key_rotated: { title: () => "Key for files changed", tone: "amber" },
};

/**
 * Newest first: what the caregiver did (from the activity table) and when each person last opened their link.
 * Unknown actions are left out rather than shown as codes.
 */
export function buildFeed(rows: ActivityRow[], people: PersonView[], limit = 8): FeedItem[] {
  const byId = new Map(people.map((person) => [person.id, person]));
  const items: FeedItem[] = [];
  for (const row of rows) {
    const known = ACTIONS[row.action];
    if (!known) continue;
    const person = row.subjectId ? byId.get(row.subjectId) : undefined;
    const name = person?.name ?? "Someone";
    items.push({ id: row.id, title: known.title(name), detail: person ? person.roleLabel : "Caregiver", at: row.at, tone: known.tone });
  }
  for (const person of activeHelpers(people)) {
    if (!person.lastSeenAt) continue;
    items.push({ id: `seen-${person.id}`, title: `${person.name} opened their link`, detail: person.roleLabel, at: person.lastSeenAt, tone: "green" });
  }
  return items.sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
}

/** The four numbers at the top of the caregiver's Today screen. */
export function buildStats(circleId: string, people: PersonView[], content: CircleContent | null, now = Date.now()): Stat[] {
  const helpers = activeHelpers(people);
  const openedThisWeek = helpers.filter((person) => person.lastSeenAt && now - new Date(person.lastSeenAt).getTime() < WEEK_MS).length;
  const notOpened = helpers.filter((person) => !person.lastSeenAt).length;
  const allergies = content?.allergies ?? [];
  const peopleHref = `/circles/${circleId}/members`;
  return [
    { key: "helpers", label: "People helping", value: helpers.length, detail: helpers.length === 1 ? "1 link on" : `${helpers.length} links on`, tone: "blue", href: peopleHref },
    { key: "opened", label: "Opened this week", value: openedThisWeek, detail: `of ${helpers.length}`, tone: "green", href: peopleHref },
    { key: "waiting", label: "Not opened yet", value: notOpened, detail: notOpened ? "Send their link again" : "Everyone has opened", tone: notOpened ? "amber" : "neutral", href: peopleHref },
    {
      key: "allergies",
      label: "Allergies",
      value: allergies.length,
      detail: allergies.length ? allergies.slice(0, 3).join(", ") : "None recorded",
      tone: allergies.length ? "attn" : "neutral",
      href: `/circles/${circleId}/summary`,
    },
  ];
}

/** Links that need the caregiver: never opened, locked by wrong PINs, or about to expire. Empty ones are left out. */
export function buildAlerts(circleId: string, people: PersonView[], now = Date.now()): Alert[] {
  const helpers = activeHelpers(people);
  const href = `/circles/${circleId}/members`;
  const alerts: Alert[] = [
    { key: "locked", label: "Links locked by wrong PINs", count: helpers.filter((person) => person.locked).length, tone: "attn", href },
    { key: "unopened", label: "Links not opened yet", count: helpers.filter((person) => !person.lastSeenAt).length, tone: "amber", href },
    {
      key: "expiring",
      label: "Links ending within 2 weeks",
      count: helpers.filter((person) => person.expiresAt && new Date(person.expiresAt).getTime() - now < EXPIRING_MS).length,
      tone: "blue",
      href,
    },
  ];
  return alerts.filter((alert) => alert.count > 0);
}
