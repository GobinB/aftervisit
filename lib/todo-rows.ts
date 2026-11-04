import type { TodoRow } from "@/components/todos/TodoList";
import type { Actor } from "@/lib/auth";
import { can } from "@/lib/permissions";
import type { PersonView } from "@/lib/schema/circles";
import { isMine, type Todo } from "@/lib/schema/todos";

export function viewerOf(actor: Actor): { kind: "caregiver" } | { kind: "member"; memberId: string } {
  return actor.kind === "caregiver" ? { kind: "caregiver" } : { kind: "member", memberId: actor.memberId };
}

/** Adds who has each to-do, in words, and what this viewer may do with it. */
export function todoRows(actor: Actor, circleId: string, todos: Todo[], people: PersonView[] | null): TodoRow[] {
  const viewer = viewerOf(actor);
  const names = new Map((people ?? []).filter((person) => person.kind === "member").map((person) => [person.id, person.name]));
  const caregiverName = (people ?? []).find((person) => person.kind === "caregiver")?.name ?? "Caregiver";
  const updateAny = can(actor, "tasks:update", { circleId });
  const claim = can(actor, "tasks:claim", { circleId });
  return todos.map((todo) => {
    const mine = isMine(todo, viewer);
    const ownerLabel = mine
      ? "You"
      : !todo.assignee
        ? "Needs a volunteer"
        : todo.assignee.kind === "caregiver"
          ? caregiverName
          : (names.get(todo.assignee.memberId) ?? "Someone");
    const canToggle =
      updateAny || (actor.kind === "helper" && mine && can(actor, "tasks:update:own", { circleId, assigneeId: actor.memberId }));
    return { ...todo, ownerLabel, canToggle, canClaim: claim && todo.status === "open" && !todo.assignee };
  });
}
