"use client";

import { Pencil } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { ClaimButton, DoneToggle, DueLabel, GiveTo, type AssignOption } from "@/components/todos/TodoControls";
import type { Todo } from "@/lib/schema/todos";

export type TodoRow = Todo & { ownerLabel: string; canToggle: boolean; canClaim: boolean };

/**
 * One reminder per row: what needs doing, who has it and when it is due, then its buttons: Done,
 * "I'll do it" and, for the caregiver, "Give to…". A reminder marked done here stays in its place,
 * crossed out, until the page is left; the server's list would otherwise drop it from under the finger.
 */
export function TodoList({ todos, circleId, canEdit, people = [] }: { todos: TodoRow[]; circleId?: string; canEdit: boolean; people?: AssignOption[] }) {
  // Rows finished (or given away) on this screen, kept where they were.
  const [kept, setKept] = useState<{ row: TodoRow; index: number }[]>([]);
  const [owners, setOwners] = useState<Record<string, string>>({});
  const [doneHere, setDoneHere] = useState<Record<string, boolean>>({});

  const rows = [...todos];
  for (const { row, index } of kept) if (!rows.some((item) => item.id === row.id)) rows.splice(Math.min(index, rows.length), 0, row);

  const keep = (row: TodoRow) =>
    setKept((all) => (all.some((item) => item.row.id === row.id) ? all : [...all, { row, index: todos.findIndex((item) => item.id === row.id) }]));

  return (
    <ul className="divide-y divide-border-200">
      {rows.map((todo) => {
        const done = doneHere[todo.id] ?? todo.status === "done";
        const owner = owners[todo.id] ?? todo.ownerLabel;
        const unassigned = !todo.assignee && !owners[todo.id];
        const giveTo = canEdit && circleId && unassigned && !done && people.length;
        return (
          <li key={todo.id} className="px-4 py-3">
            <span className={`block text-label font-medium ${done ? "text-ink-500 line-through decoration-ink-500/60" : "text-ink-900"}`}>{todo.title}</span>
            {todo.note ? <span className="mt-0.5 block text-hint whitespace-pre-line text-ink-500">{todo.note}</span> : null}
            <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-hint text-ink-500">
              <span className={`rounded px-1.5 py-0.5 font-medium ${unassigned ? "bg-med-bg text-med-ink" : "bg-sky-100 text-primary-900"}`}>{owner}</span>
              {todo.dueDate ? <DueLabel date={todo.dueDate} done={done} /> : null}
            </span>
            {circleId && (todo.canToggle || (todo.canClaim && !done) || giveTo || canEdit) ? (
              <span className="mt-2 flex flex-wrap items-start gap-2">
                {todo.canToggle ? (
                  <DoneToggle
                    circleId={circleId}
                    id={todo.id}
                    title={todo.title}
                    done={done}
                    onChange={(value) => {
                      keep(todo);
                      setDoneHere((all) => ({ ...all, [todo.id]: value }));
                    }}
                  />
                ) : null}
                {todo.canClaim && !done && unassigned ? <ClaimButton
                    circleId={circleId}
                    id={todo.id}
                    onClaimed={() => {
                      keep(todo);
                      setOwners((all) => ({ ...all, [todo.id]: "You" }));
                    }}
                  /> : null}
                {giveTo ? (
                  <GiveTo
                    circleId={circleId}
                    id={todo.id}
                    title={todo.title}
                    people={people}
                    onGiven={(label) => {
                      keep(todo);
                      setOwners((all) => {
                        const next = { ...all };
                        if (label) next[todo.id] = label;
                        else delete next[todo.id];
                        return next;
                      });
                    }}
                  />
                ) : null}
                {canEdit ? (
                  <Link
                    href={`/circles/${circleId}/todos/${todo.id}`}
                    aria-label={`Edit "${todo.title}"`}
                    className="ml-auto inline-flex size-11 items-center justify-center rounded-lg border border-border-200 bg-white text-ink-500 hover:bg-paper-100 hover:text-ink-900"
                  >
                    <Pencil className="size-4" aria-hidden="true" />
                  </Link>
                ) : null}
              </span>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
