"use client";

import { Check, Hand } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { claimTodoAction, setTodoDoneAction } from "@/app/actions/todos";
import { localToday } from "@/lib/schema/todos";

/**
 * The round check: marks a reminder done, or open again. It changes the moment it is tapped and
 * saves in the background; if saving fails it goes back and says so.
 */
export function DoneToggle({ circleId, id, title, done }: { circleId: string; id: string; title: string; done: boolean }) {
  const router = useRouter();
  const [, start] = useTransition();
  const [shown, setShown] = useState(done);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setShown(done), [done]);
  return (
    <span className="inline-flex flex-col">
      <button
        type="button"
        role="checkbox"
        aria-checked={shown}
        aria-label={shown ? `Mark "${title}" not done` : `Mark "${title}" done`}
        onClick={() => {
          const next = !shown;
          setShown(next);
          setError(null);
          start(async () => {
            const result = await setTodoDoneAction({ circleId, id, done: next });
            if (!result.ok) {
              setShown(!next);
              setError(result.error);
            } else router.refresh();
          });
        }}
        className={`-m-2.5 flex size-11 items-center justify-center rounded-full`}
      >
        <span
          className={`flex size-7 items-center justify-center rounded-full border-2 transition-colors ${
            shown ? "border-ok bg-ok text-white" : "border-ink-500/40 bg-white text-transparent hover:border-ok hover:text-ok/60"
          }`}
        >
          <Check className="size-4" strokeWidth={3} aria-hidden="true" />
        </span>
      </button>
      {error ? (
        <span role="alert" className="mt-1 text-[12px] text-attn-ink">
          {error}
        </span>
      ) : null}
    </span>
  );
}

/** "I'll do it" on a reminder nobody has taken. It says "It's yours" at once and saves in the background. */
export function ClaimButton({ circleId, id }: { circleId: string; id: string }) {
  const router = useRouter();
  const [, start] = useTransition();
  const [taken, setTaken] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-col items-end">
      <button
        type="button"
        disabled={taken}
        onClick={() => {
          setTaken(true);
          setError(null);
          start(async () => {
            const result = await claimTodoAction({ circleId, id });
            if (!result.ok) {
              setTaken(false);
              setError(result.error);
            }
            router.refresh();
          });
        }}
        className={`inline-flex min-h-10 items-center gap-1.5 rounded-md px-3 text-[14px] font-semibold ${
          taken ? "bg-ok-bg text-ok-ink" : "bg-primary-700 text-white hover:bg-primary-900"
        }`}
      >
        {taken ? <Check className="size-4" aria-hidden="true" /> : <Hand className="size-4" aria-hidden="true" />}
        {taken ? "It's yours" : "I'll do it"}
      </button>
      {error ? (
        <span role="alert" className="mt-1 text-[12px] text-attn-ink">
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
  const day = `${MONTHS[(m ?? 1) - 1]} ${d}`;
  if (done || !today) return <span>Due {day}</span>;
  if (date < today) return <span className="font-semibold text-attn-ink">Overdue · {day}</span>;
  if (date === today) return <span className="font-semibold text-med-ink">Due today</span>;
  return <span>Due {day}</span>;
}
