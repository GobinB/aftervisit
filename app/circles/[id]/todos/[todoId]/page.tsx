import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { TodoForm } from "@/components/todos/TodoForm";
import { getActor } from "@/lib/auth";
import { listPeople } from "@/services/members";
import { getTodo } from "@/services/todos";

export const metadata: Metadata = { title: "Edit to-do", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function EditTodoPage({ params }: { params: Promise<{ id: string; todoId: string }> }) {
  const { id, todoId } = await params;
  const actor = await getActor(id);
  if (!actor) redirect(`/login?next=/circles/${id}/todos/${todoId}`);
  const todo = /^[0-9a-f-]{36}$/i.test(todoId) ? await getTodo(actor, id, todoId) : null;
  if (!todo) notFound();
  const listed = await listPeople(actor, id);
  const options = (listed.ok ? listed.people : [])
    .filter((person) => person.kind === "member" && !person.revokedAt)
    .map((person) => ({ value: person.id, label: `${person.name} (${person.roleLabel})` }));
  return (
    <>
      <h1 className="font-display mb-5 text-[26px] leading-tight text-primary-900">Edit to-do</h1>
      <div className="max-w-2xl">
        <TodoForm circleId={id} people={options} todo={todo} />
      </div>
    </>
  );
}
