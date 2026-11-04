"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { deleteTodoAction, saveTodoAction } from "@/app/actions/todos";
import type { Todo } from "@/lib/schema/todos";

const field = "block h-10 w-full rounded-md border border-border-200 bg-white px-3 text-[14px] text-ink-900";

export type AssigneeOption = { value: string; label: string };

/** Quick add on the list (one line, more on demand), or the full form when editing. */
export function TodoForm({ circleId, people, todo }: { circleId: string; people: AssigneeOption[]; todo?: Todo }) {
  const id = useId();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState(todo?.title ?? "");
  const [note, setNote] = useState(todo?.note ?? "");
  const [dueDate, setDueDate] = useState(todo?.dueDate ?? "");
  const [assignee, setAssignee] = useState(todo?.assignee ? (todo.assignee.kind === "caregiver" ? "caregiver" : todo.assignee.memberId) : "none");
  const [expanded, setExpanded] = useState(Boolean(todo));

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    start(async () => {
      const result = await saveTodoAction({ circleId, ...(todo ? { id: todo.id } : {}), title, note, dueDate, assignee });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (todo) {
        router.push(`/circles/${circleId}/todos`);
      } else {
        setTitle("");
        setNote("");
        setDueDate("");
        setAssignee("none");
        setExpanded(false);
      }
      router.refresh();
    });
  };

  const remove = () => {
    if (!todo || !window.confirm(`Delete "${todo.title}"? This cannot be undone.`)) return;
    start(async () => {
      const result = await deleteTodoAction({ circleId, id: todo.id });
      if (!result.ok) setError(result.error);
      else {
        router.push(`/circles/${circleId}/todos`);
        router.refresh();
      }
    });
  };

  return (
    <form onSubmit={submit} className="rounded-lg border border-border-200 bg-white p-3 sm:p-4" noValidate>
      <div className="flex flex-col gap-2 sm:flex-row">
        <label htmlFor={`${id}-title`} className="sr-only">
          What needs doing
        </label>
        <input
          id={`${id}-title`}
          className={`${field} flex-1`}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          onFocus={() => setExpanded(true)}
          maxLength={200}
          placeholder="What needs doing?"
        />
        {!todo ? (
          <button type="submit" disabled={pending} className="inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-md bg-primary-700 px-4 text-[14px] font-semibold text-white hover:bg-primary-900 disabled:opacity-50">
            <Plus className="size-4" aria-hidden="true" /> {pending ? "Adding" : "Add"}
          </button>
        ) : null}
      </div>
      {expanded ? (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor={`${id}-who`} className="block text-[13px] font-medium text-ink-900">
              Who
            </label>
            <select id={`${id}-who`} className={`${field} mt-1`} value={assignee} onChange={(event) => setAssignee(event.target.value)}>
              <option value="none">Needs a volunteer</option>
              <option value="caregiver">Me</option>
              {people.map((person) => (
                <option key={person.value} value={person.value}>
                  {person.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor={`${id}-due`} className="block text-[13px] font-medium text-ink-900">
              By when
            </label>
            <input id={`${id}-due`} type="date" className={`${field} mt-1`} value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor={`${id}-note`} className="block text-[13px] font-medium text-ink-900">
              Note
            </label>
            <textarea
              id={`${id}-note`}
              rows={2}
              className="mt-1 block w-full rounded-md border border-border-200 bg-white px-3 py-2 text-[14px] text-ink-900"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              maxLength={1000}
              placeholder="Phone number, policy number, anything that helps"
            />
          </div>
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="mt-3 rounded-md bg-attn-bg px-3 py-2 text-[13px] text-attn-ink">
          {error}
        </p>
      ) : null}
      {todo ? (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button type="submit" disabled={pending} className="inline-flex h-10 items-center rounded-md bg-primary-700 px-4 text-[14px] font-semibold text-white hover:bg-primary-900 disabled:opacity-50">
            {pending ? "Saving" : "Save"}
          </button>
          <Link href={`/circles/${circleId}/todos`} className="inline-flex h-10 items-center rounded-md px-3 text-[14px] font-medium text-ink-500 hover:text-ink-900">
            Cancel
          </Link>
          <button type="button" onClick={remove} disabled={pending} className="ml-auto inline-flex h-10 items-center rounded-md px-3 text-[14px] font-medium text-attn-ink hover:bg-attn-bg">
            Delete
          </button>
        </div>
      ) : null}
    </form>
  );
}
