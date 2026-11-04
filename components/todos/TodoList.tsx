import { Pencil } from "lucide-react";
import Link from "next/link";
import { ClaimButton, DoneToggle, DueLabel } from "@/components/todos/TodoControls";
import type { Todo } from "@/lib/schema/todos";

export type TodoRow = Todo & { ownerLabel: string; canToggle: boolean; canClaim: boolean };

/** One to-do per row: the check, what needs doing, who has it and when it is due. */
export function TodoList({ todos, circleId, canEdit }: { todos: TodoRow[]; circleId?: string; canEdit: boolean }) {
  return (
    <ul className="divide-y divide-border-200">
      {todos.map((todo) => (
        <li key={todo.id} className="flex items-start gap-3 px-4 py-3">
          <span className="mt-0.5 shrink-0">
            {todo.canToggle && circleId ? (
              <DoneToggle circleId={circleId} id={todo.id} title={todo.title} done={todo.status === "done"} />
            ) : (
              <span className={`block size-6 rounded-full border-2 ${todo.status === "done" ? "border-ok bg-ok" : "border-border-200"}`} aria-hidden="true" />
            )}
          </span>
          <span className="min-w-0 flex-1">
            <span className={`block text-[15px] font-medium ${todo.status === "done" ? "text-ink-500 line-through decoration-ink-500/40" : "text-ink-900"}`}>
              {todo.title}
            </span>
            {todo.note ? <span className="mt-0.5 block text-[13px] whitespace-pre-line text-ink-500">{todo.note}</span> : null}
            <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-ink-500">
              <span
                className={`rounded px-1.5 py-0.5 font-medium ${todo.assignee ? "bg-sky-100 text-primary-900" : "bg-med-bg text-med-ink"}`}
              >
                {todo.ownerLabel}
              </span>
              {todo.dueDate ? <DueLabel date={todo.dueDate} done={todo.status === "done"} /> : null}
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-1.5">
            {todo.canClaim && circleId ? <ClaimButton circleId={circleId} id={todo.id} /> : null}
            {canEdit && circleId ? (
              <Link
                href={`/circles/${circleId}/todos/${todo.id}`}
                aria-label={`Edit "${todo.title}"`}
                className="inline-flex size-8 items-center justify-center rounded-md border border-border-200 bg-white text-ink-500 hover:bg-paper-100 hover:text-ink-900"
              >
                <Pencil className="size-3.5" aria-hidden="true" />
              </Link>
            ) : null}
          </span>
        </li>
      ))}
    </ul>
  );
}
