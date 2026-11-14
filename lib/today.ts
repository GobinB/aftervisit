import type { CircleContent, PersonView } from "@/lib/schema/circles";
import type { Todo } from "@/lib/schema/todos";

/** One row of the circle's activity table, as the Today screen reads it. */
export type ActivityRow = { id: string; action: string; subjectId: string | null; at: string; actor?: string };

export type Tone = "blue" | "green" | "amber" | "attn" | "neutral" | "primary";

export type FeedItem = { id: string; title: string; detail: string; at: string; tone: Tone };

export type Stat = { key: string; label: string; value: number | null; detail: string; tone: Tone; href?: string };

export type Alert = { key: string; label: string; count: number; tone: Tone; href: string };

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
  circle_key_reset: { title: () => "Older saved summaries removed", tone: "amber" },
  visit_applied: { title: () => "Visit summary added to the circle", tone: "blue" },
};

const TODO_ACTIONS: Record<string, { title: (who: string, todo: string) => string; tone: Tone }> = {
  todo_added: { title: (_who, todo) => `New reminder: ${todo}`, tone: "blue" },
  todo_claimed: { title: (who, todo) => `${who} took on: ${todo}`, tone: "blue" },
  todo_done: { title: (who, todo) => `${who} finished: ${todo}`, tone: "green" },
  todo_reopened: { title: (who, todo) => `${who} reopened: ${todo}`, tone: "neutral" },
  event_added: { title: (who, event) => `${who} added to the calendar: ${event}`, tone: "blue" },
  event_claimed: { title: (who, event) => `${who} is going: ${event}`, tone: "green" },
};

/** "member:<id>" or "caregiver:<user id>" to a name the circle knows. */
function actorName(actor: string | undefined, people: PersonView[]): string {
  const [kind, id] = (actor ?? "").split(":");
  const person = people.find((p) => p.id === id && (kind === "member" ? p.kind === "member" : p.kind === "caregiver"));
  return person?.name ?? (kind === "caregiver" ? "The caregiver" : "Someone");
}

/**
 * Newest first: what the caregiver did (from the activity table) and when each person last opened their link.
 * Unknown actions are left out rather than shown as codes.
 */
export function buildFeed(rows: ActivityRow[], people: PersonView[], limit = 8, todos: Todo[] = [], events: { id: string; title: string }[] = []): FeedItem[] {
  const byId = new Map(people.map((person) => [person.id, person]));
  const items: FeedItem[] = [];
  const todoTitles = new Map([...todos, ...events].map((item) => [item.id, item.title]));
  for (const row of rows) {
    const todoAction = TODO_ACTIONS[row.action];
    if (todoAction) {
      const title = row.subjectId ? todoTitles.get(row.subjectId) : undefined;
      if (!title) continue;
      items.push({ id: row.id, title: todoAction.title(actorName(row.actor, people), title), detail: row.action.startsWith("event") ? "Calendar" : "Reminder", at: row.at, tone: todoAction.tone });
      continue;
    }
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

/**
 * The four cards at the top of the caregiver's Today screen: scanning a visit summary first, as the
 * main way in, then medications, reminders and allergies. Each card opens its page, or the form
 * to add the first entry when there is none yet.
 */
export function buildTodayCards(
  circleId: string,
  content: CircleContent | null,
  medications: { name: string; status: string }[] | null,
  todos: Todo[] | null,
): Stat[] {
  const base = `/circles/${circleId}`;
  const active = (medications ?? []).filter((med) => med.status === "active");
  const open = (todos ?? []).filter((todo) => todo.status === "open");
  const volunteer = open.filter((todo) => !todo.assignee).length;
  const allergies = content?.allergies ?? [];
  return [
    { key: "scan", label: "Scan after-visit summary", value: null, detail: "Take photos of the pages", tone: "primary", href: `/new?circle=${circleId}` },
    {
      key: "meds",
      label: "Medications",
      value: active.length,
      detail: active.length ? active.slice(0, 2).map((med) => med.name).join(", ") + (active.length > 2 ? "…" : "") : "Add the first one",
      tone: "blue",
      href: active.length ? `${base}/medications` : `${base}/medications/new`,
    },
    {
      key: "reminders",
      label: "Reminders",
      value: open.length,
      detail: volunteer ? `${volunteer} need${volunteer === 1 ? "s" : ""} someone` : open.length ? "Everyone has one" : "Add one",
      tone: volunteer ? "amber" : "blue",
      href: `${base}/todos`,
    },
    {
      key: "allergies",
      label: "Allergies",
      value: allergies.length,
      detail: allergies.length ? allergies.slice(0, 3).join(", ") : "Tap to add",
      tone: allergies.length ? "attn" : "neutral",
      href: allergies.length ? `${base}/summary` : `${base}/summary/edit?part=allergies`,
    },
  ];
}

/** Parts of the care summary still empty, each a card on Today until it is filled in. */
export function missingDetails(circleId: string, content: CircleContent | null): { key: string; label: string; href: string }[] {
  if (!content) return [];
  const edit = (part: string) => `/circles/${circleId}/summary/edit?part=${part}`;
  return [
    content.doctors.length ? null : { key: "doctors", label: "Add their doctors", href: edit("doctors") },
    content.emergency_contacts.length ? null : { key: "contacts", label: "Who to call in an emergency", href: edit("contacts") },
    content.pharmacy?.name ? null : { key: "pharmacy", label: "Add their pharmacy", href: edit("pharmacy") },
  ].filter((item): item is { key: string; label: string; href: string } => item !== null);
}

/** Links that need the caregiver: never opened, locked by wrong PINs, or about to expire. Empty ones are left out. */
export function buildAlerts(circleId: string, people: PersonView[], now = Date.now(), todos: Todo[] = []): Alert[] {
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
  alerts.push({
    key: "volunteer",
    label: "Reminders that need a volunteer",
    count: todos.filter((todo) => todo.status === "open" && !todo.assignee).length,
    tone: "amber",
    href: `/circles/${circleId}/todos?show=volunteer`,
  });
  return alerts.filter((alert) => alert.count > 0);
}
