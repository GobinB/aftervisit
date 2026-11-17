"use client";

import { Check, Hand, RotateCcw, UserPlus } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { assignTodoAction, claimTodoAction, setTodoDoneAction } from "@/app/actions/todos";
import { localToday } from "@/lib/schema/todos";

const pill = "inline-flex min-h-11 items-center gap-1.5 rounded-lg border px-3 text-note font-semibold";

/**
 * "Done": a labelled button, not a bare circle, so it is clear what a tap does. The reminder stays on
 * the list crossed out (TodoList keeps it). Tapping "Done" again asks before opening it again, so a
 * stray tap never undoes it. It changes at once and saves in the background; if saving fails it goes
 * back and says so.
 */
export function DoneToggle({
  circleId,
  id,
  title,
  done,
  onChange,
}: {
  circleId: string;
  id: string;
  title: string;
  done: boolean;
  onChange?: (done: boolean) => void;
}) {
  const [, start] = useTransition();
  const [shown, setShown] = useState(done);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setShown(done), [done]);

  const save = (next: boolean) => {
    setShown(next);
    setAsking(false);
    setError(null);
    onChange?.(next);
    start(async () => {
      const result = await setTodoDoneAction({ circleId, id, done: next }).catch(() => ({ ok: false as const, error: "Check your connection and try again." }));
      if (!result.ok) {
        setShown(!next);
        onChange?.(!next);
        setError(result.error);
      }
    });
  };

  if (asking) {
    return (
      <span role="group" aria-label={`Not done yet: ${title}?`} className="inline-flex flex-wrap items-center gap-2 rounded-lg bg-paper-100 px-2 py-1">
        <span className="text-note text-ink-900">Not done yet?</span>
        <button type="button" onClick={() => save(false)} className={`${pill} border-primary-700 bg-white text-primary-700 hover:bg-sky-100`}>
          <RotateCcw className="size-4" aria-hidden="true" /> Yes, open it again
        </button>
        <button type="button" onClick={() => setAsking(false)} className={`${pill} border-transparent text-ink-500 hover:text-ink-900`}>
          Keep done
        </button>
      </span>
    );
  }

  return (
    <span className="inline-flex flex-col">
      <button
        type="button"
        aria-pressed={shown}
        aria-label={shown ? `Done: ${title}` : `Mark done: ${title}`}
        onClick={() => (shown ? setAsking(true) : save(true))}
        className={`${pill} ${shown ? "border-ok bg-ok text-white hover:bg-ok-ink" : "border-ok/60 bg-white text-ok-ink hover:bg-ok-bg"}`}
      >
        <Check className="size-4" strokeWidth={3} aria-hidden="true" />
        {shown ? "Done" : "Mark done"}
      </button>
      {error ? (
        <span role="alert" className="mt-1 text-hint text-attn-ink">
          {error}
        </span>
      ) : null}
    </span>
  );
}

/** "I'll do it" on a reminder nobody has taken. It says "It's yours" at once and saves in the background. */
export function ClaimButton({ circleId, id, onClaimed }: { circleId: string; id: string; onClaimed?: () => void }) {
  const [, start] = useTransition();
  const [taken, setTaken] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-col">
      <button
        type="button"
        disabled={taken}
        onClick={() => {
          setTaken(true);
          setError(null);
          onClaimed?.();
          start(async () => {
            const result = await claimTodoAction({ circleId, id });
            if (!result.ok) {
              setTaken(false);
              setError(result.error);
            }
          });
        }}
        className={`${pill} ${taken ? "border-ok-bg bg-ok-bg text-ok-ink" : "border-primary-700 bg-primary-700 text-white hover:bg-primary-900"}`}
      >
        {taken ? <Check className="size-4" aria-hidden="true" /> : <Hand className="size-4" aria-hidden="true" />}
        {taken ? "It's yours" : "I'll do it"}
      </button>
      {error ? (
        <span role="alert" className="mt-1 text-hint text-attn-ink">
          {error}
        </span>
      ) : null}
    </span>
  );
}

export type AssignOption = { value: string; label: string };

/**
 * "Give to…" on a reminder nobody has taken: the people in the circle as buttons, one tap to hand it
 * over. Only the caregiver sees it. Saves in the background; the row shows the new name at once.
 */
export function GiveTo({ circleId, id, title, people, onGiven }: { circleId: string; id: string; title: string; people: AssignOption[]; onGiven: (label: string | null) => void }) {
  const [, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const give = (option: AssignOption) => {
    setOpen(false);
    setError(null);
    onGiven(option.label);
    start(async () => {
      const result = await assignTodoAction({ circleId, id, assignee: option.value }).catch(() => ({ ok: false as const, error: "Check your connection and try again." }));
      if (!result.ok) {
        onGiven(null);
        setError(result.error);
      }
    });
  };

  return (
    <span className="inline-flex flex-col items-start">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className={`${pill} border-border-200 bg-white text-primary-700 hover:bg-sky-100`}
      >
        <UserPlus className="size-4" aria-hidden="true" /> Give to…
      </button>
      {open ? (
        <ul aria-label={`Give "${title}" to`} className="mt-2 flex flex-wrap gap-2">
          {people.map((option) => (
            <li key={option.value}>
              <button
                type="button"
                onClick={() => give(option)}
                className="inline-flex min-h-11 items-center rounded-full border border-border-200 bg-white px-4 text-label font-semibold text-primary-900 hover:bg-sky-100"
              >
                {option.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {error ? (
        <span role="alert" className="mt-1 text-hint text-attn-ink">
          {error}
        </span>
      ) : null}
    </span>
  );
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Due today", "Overdue · Nov 1", "Due Nov 5", worked out in the viewer's own day. */
export function DueLabel({ date, done }: { date: string; done: boolean }) {
  const [today, setToday] = useState<string | null>(null);
  useEffect(() => setToday(localToday()), []);
  const [, m, d] = date.split("-").map(Number);
  const day = `${MONTHS[(m ?? 1) - 1]} ${d}`;
  if (done || !today) return <span>Due {day}</span>;
  if (date < today) return <span className="font-semibold text-attn-ink">Overdue · {day}</span>;
  if (date === today) return <span className="font-semibold text-med-ink">Due today</span>;
  return <span>Due {day}</span>;
}
