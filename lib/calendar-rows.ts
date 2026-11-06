import type { Actor } from "@/lib/auth";
import { can } from "@/lib/permissions";
import type { PersonView } from "@/lib/schema/circles";
import { expand, timeText, type CareEvent } from "@/lib/schema/events";
import type { Todo } from "@/lib/schema/todos";

/** One line on the calendar: an event on one of its dates, or a to-do on its due date. */
export type CalendarItem = {
  key: string;
  kind: "event" | "todo";
  id: string;
  date: string;
  title: string;
  time: string;
  sortTime: string;
  /** "09:00" for an event at a time; null for an all-day event or a reminder. */
  startTime: string | null;
  endTime: string | null;
  location: string | null;
  notes: string | null;
  who: string | null;
  needsSomeone: boolean;
  canGo: boolean;
  repeats: boolean;
};

/** Events in the range (repeats expanded) plus open to-dos due in it, with names and what this viewer may do. */
export function calendarItems(actor: Actor, circleId: string, events: CareEvent[], todos: Todo[], people: PersonView[] | null, from: string, to: string): CalendarItem[] {
  const names = new Map((people ?? []).filter((person) => person.kind === "member").map((person) => [person.id, person.name]));
  const caregiverName = (people ?? []).find((person) => person.kind === "caregiver")?.name ?? "Caregiver";
  const me = actor.kind === "helper" ? actor.memberId : null;
  const nameOf = (going: CareEvent["going"]) => {
    if (!going) return null;
    if (going.kind === "caregiver") return actor.kind === "caregiver" ? "You" : caregiverName;
    return going.memberId === me ? "You" : (names.get(going.memberId) ?? "Someone");
  };
  const edit = can(actor, "calendar:edit", { circleId });
  const items: CalendarItem[] = expand(events, from, to).map(({ event, date }) => {
    const needsSomeone = event.needsVolunteer && !event.going;
    return {
      key: `${event.id}-${date}`,
      kind: "event",
      id: event.id,
      date,
      title: event.title,
      time: timeText(event),
      sortTime: event.startTime ?? "",
      startTime: event.startTime,
      endTime: event.endTime,
      location: event.location,
      notes: event.notes,
      who: nameOf(event.going),
      needsSomeone,
      canGo: needsSomeone && edit,
      repeats: event.repeat !== "none",
    };
  });
  for (const todo of todos) {
    if (todo.status !== "open" || !todo.dueDate || todo.dueDate < from || todo.dueDate > to) continue;
    const who = !todo.assignee ? null : todo.assignee.kind === "caregiver" ? nameOf({ kind: "caregiver" }) : nameOf({ kind: "member", memberId: todo.assignee.memberId });
    items.push({
      key: `todo-${todo.id}`,
      kind: "todo",
      id: todo.id,
      date: todo.dueDate,
      title: todo.title,
      time: "Reminder due",
      sortTime: "99:99",
      startTime: null,
      endTime: null,
      location: null,
      notes: null,
      who,
      needsSomeone: false,
      canGo: false,
      repeats: false,
    });
  }
  return items.sort((a, b) => a.date.localeCompare(b.date) || a.sortTime.localeCompare(b.sortTime) || a.title.localeCompare(b.title));
}
