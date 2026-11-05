import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { circleTabs } from "@/components/circles/CircleFrame";
import { CircleShell } from "@/components/circles/Shell";
import { Card } from "@/components/circles/Today";
import { TodoForm } from "@/components/todos/TodoForm";
import { TodoList } from "@/components/todos/TodoList";
import { getActor } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { TODO_VIEWS, TODO_VIEW_LABELS, filterTodos, sortTodos, type TodoView } from "@/lib/schema/todos";
import { todoRows, viewerOf } from "@/lib/todo-rows";
import { getCircle } from "@/services/circles";
import { listPeople } from "@/services/members";
import { listTodos } from "@/services/todos";

export const metadata: Metadata = { title: "To-dos", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const EMPTY: Record<TodoView, string> = {
  open: "Nothing to do right now.",
  mine: "Nothing is on your list.",
  volunteer: "Every to-do has someone on it.",
  done: "Finished to-dos will show here.",
};

export default async function TodosPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ show?: string }> }) {
  const { id } = await params;
  const { show } = await searchParams;
  const actor = await getActor(id);
  if (!actor) redirect(`/login?next=/circles/${id}/todos`);
  const todos = await listTodos(actor, id);
  if (!todos) notFound();
  const content = await getCircle(actor, id);
  const personName = content?.person_name ?? "Your care circle";
  const listed = await listPeople(actor, id);
  const people = listed.ok ? listed.people : null;
  const canEdit = can(actor, "tasks:manage", { circleId: id });
  const seesAll = can(actor, "tasks:read", { circleId: id });
  const views: TodoView[] = seesAll ? [...TODO_VIEWS] : ["open", "done"];
  const view: TodoView = views.includes(show as TodoView) ? (show as TodoView) : views[0];
  const viewer = viewerOf(actor);
  const rows = todoRows(actor, id, sortTodos(filterTodos(todos, view, viewer)), people);
  const counts = Object.fromEntries(views.map((key) => [key, filterTodos(todos, key, viewer).length])) as Record<TodoView, number>;
  const options = (people ?? [])
    .filter((person) => person.kind === "member" && !person.revokedAt)
    .map((person) => ({ value: person.id, label: `${person.name} (${person.roleLabel})` }));

  return (
    <CircleShell signedIn={actor.kind === "caregiver"} circle={{ personName, tabs: circleTabs(actor, id), active: "todos" }}>
      <div className="mb-5">
        <h1 className="font-display text-[26px] leading-tight tracking-[-0.01em] text-primary-900">To-dos</h1>
        <p className="mt-1 text-[13px] text-ink-500">
          {personName} · {counts.open} open{seesAll && counts.volunteer ? ` · ${counts.volunteer} need a volunteer` : ""}
        </p>
      </div>

      {canEdit ? (
        <div className="mb-5">
          <TodoForm circleId={id} people={options} />
        </div>
      ) : null}

      <nav aria-label="Which to-dos" className="mb-3 flex gap-1.5 overflow-x-auto [scrollbar-width:none]">
        {views.map((key) => (
          <Link
            key={key}
            href={key === views[0] ? `/circles/${id}/todos` : `/circles/${id}/todos?show=${key}`}
            aria-current={key === view ? "page" : undefined}
            className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium ${
              key === view ? "border-primary-700 bg-primary-700 text-white" : "border-border-200 bg-white text-ink-900 hover:bg-paper-100"
            }`}
          >
            {TODO_VIEW_LABELS[key]}
            <span className={`tabular-nums ${key === view ? "text-white/80" : "text-ink-500"}`}>{counts[key]}</span>
          </Link>
        ))}
      </nav>

      <Card>
        {rows.length ? (
          <TodoList todos={rows} circleId={id} canEdit={canEdit} />
        ) : (
          <p className="px-4 py-10 text-center text-[14px] text-ink-500">{EMPTY[view]}</p>
        )}
      </Card>
    </CircleShell>
  );
}
