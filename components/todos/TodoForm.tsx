"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { deleteTodoAction, saveTodoAction } from "@/app/actions/todos";
import { Chips } from "@/components/ui/Chips";
import type { Todo } from "@/lib/schema/todos";
import { COMMON_REMINDERS } from "@/lib/suggestions";

const field = "block h-12 w-full rounded-lg border border-border-200 bg-white px-3 text-[16px] text-ink-900 sm:h-11 sm:text-[15px]";

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
          Reminder
        </label>
        <input
          id={`${id}-title`}
          className={`${field} sm:flex-1`}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          onFocus={() => setExpanded(true)}
          maxLength={200}
          placeholder="e.g. Pick up prescription"
        />
        {!todo ? (
          <button type="submit" disabled={pending} className="inline-flex h-12 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-primary-700 px-5 text-[16px] font-semibold sm:h-11 text-white hover:bg-primary-900 disabled:opacity-50">
            <Plus className="size-4" aria-hidden="true" /> {pending ? "Adding" : "Add"}
          </button>
        ) : null}
      </div>
      {!todo && !title.trim() ? <Chips label="Common reminders" options={COMMON_REMINDERS} onPick={(value) => {
        setTitle(value);
        setExpanded(true);
      }} /> : null}
      {expanded ? (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <fieldset className="sm:col-span-2">
            <legend className="block text-[15px] font-semibold text-ink-900">Who does it?</legend>
            <WhoChips value={assignee} onPick={setAssignee} people={people} />
          </fieldset>
          <div>
            <label htmlFor={`${id}-due`} className="block text-[15px] font-semibold text-ink-900">
              By when
            </label>
            <input id={`${id}-due`} type="date" className={`${field} mt-1`} value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor={`${id}-note`} className="block text-[15px] font-semibold text-ink-900">
              Note
            </label>
            <textarea
              id={`${id}-note`}
              rows={2}
              className="mt-1 block w-full rounded-lg border border-border-200 bg-white px-3 py-2 text-[16px] text-ink-900 sm:text-[15px]"
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

/** Who does it, as large buttons: someone to offer, me, or one of the circle's people. */
export function WhoChips({
  value,
  onPick,
  people,
  options = [
    { value: "none", label: "Anyone can offer" },
    { value: "caregiver", label: "Me" },
  ],
}: {
  value: string;
  onPick: (value: string) => void;
  people: AssigneeOption[];
  options?: AssigneeOption[];
}) {
  return (
    <ul className="mt-2 flex flex-wrap gap-2">
      {[...options, ...people].map((person) => {
        const on = value === person.value;
        return (
          <li key={person.value}>
            <button
              type="button"
              aria-pressed={on}
              onClick={() => onPick(person.value)}
              className={`inline-flex min-h-11 items-center rounded-full border px-4 text-[15px] font-semibold ${
                on ? "border-primary-700 bg-primary-700 text-white" : "border-border-200 bg-white text-primary-900 hover:bg-sky-100"
              }`}
            >
              {person.label}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
