import type { Metadata } from "next";
import { PageHead } from "@/components/circles/PageHead";
import { notFound, redirect } from "next/navigation";
import { TodoForm } from "@/components/todos/TodoForm";
import { TodoViews } from "@/components/todos/TodoViews";
import { getActor } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { TODO_VIEWS, filterTodos, sortTodos, type TodoView } from "@/lib/schema/todos";
import { todoRows, viewerOf } from "@/lib/todo-rows";
import { getCircle } from "@/services/circles";
import { listPeople } from "@/services/members";
import { listTodos } from "@/services/todos";

export const metadata: Metadata = { title: "Reminders", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const EMPTY: Record<TodoView, string> = {
  open: "Nothing to do right now.",
  mine: "Nothing is on your list.",
  volunteer: "Every reminder has someone on it.",
  done: "Finished reminders will show here.",
};

export default async function TodosPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ show?: string }> }) {
  const { id } = await params;
  const { show } = await searchParams;
  const actor = await getActor(id);
  if (!actor) redirect(`/login?next=/circles/${id}/todos`);
  const [todos, content, listed] = await Promise.all([listTodos(actor, id), getCircle(actor, id), listPeople(actor, id)]);
  if (!todos) notFound();
  const personName = content?.person_name ?? "Your care circle";
  const people = listed.ok ? listed.people : null;
  const canEdit = can(actor, "tasks:manage", { circleId: id });
  const seesAll = can(actor, "tasks:read", { circleId: id });
  const views: TodoView[] = seesAll ? [...TODO_VIEWS] : ["open", "done"];
  const view: TodoView = views.includes(show as TodoView) ? (show as TodoView) : views[0];
  const viewer = viewerOf(actor);
  // Every list is sent at once, so switching between them on the phone is instant.
  const lists = Object.fromEntries(views.map((key) => [key, todoRows(actor, id, sortTodos(filterTodos(todos, key, viewer)), people)])) as Record<TodoView, ReturnType<typeof todoRows>>;
  const counts = Object.fromEntries(views.map((key) => [key, lists[key].length])) as Record<TodoView, number>;
  const options = (people ?? [])
    .filter((person) => person.kind === "member" && !person.revokedAt)
    .map((person) => ({ value: person.id, label: `${person.name} (${person.roleLabel})` }));

  return (
    <>
      <PageHead
        title="Reminders"
        subtitle={`${personName} · ${counts.open} open${seesAll && counts.volunteer ? ` · ${counts.volunteer} need a volunteer` : ""}`}
        help={
          canEdit
            ? "Things that need doing. Type one, or tap a suggestion, pick who does it, and tick it off when it is done."
            : "Things that need doing. Tap “I'll do it” to take one, and tick it off when it is done."
        }
      />

      {canEdit ? (
        <div className="mb-5">
          <TodoForm circleId={id} people={options} />
        </div>
      ) : null}

      <TodoViews circleId={id} views={views} initial={view} lists={lists} empty={EMPTY} canEdit={canEdit} />
    </>
  );
}
