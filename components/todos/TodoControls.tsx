"use client";

import { Check, Hand } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { claimTodoAction, setTodoDoneAction } from "@/app/actions/todos";
import { localToday } from "@/lib/schema/todos";

/** The round check: marks a to-do done, or open again. */
export function DoneToggle({ circleId, id, title, done }: { circleId: string; id: string; title: string; done: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-col">
      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        aria-label={done ? `Mark "${title}" not done` : `Mark "${title}" done`}
        disabled={pending}
        onClick={() => {
          setError(null);
          start(async () => {
            const result = await setTodoDoneAction({ circleId, id, done: !done });
            if (!result.ok) setError(result.error);
            else router.refresh();
          });
        }}
        className={`flex size-6 items-center justify-center rounded-full border-2 transition-colors disabled:opacity-50 ${
          done ? "border-ok bg-ok text-white" : "border-ink-500/40 bg-white text-transparent hover:border-ok hover:text-ok/60"
        }`}
      >
        <Check className="size-3.5" strokeWidth={3} aria-hidden="true" />
      </button>
      {error ? (
        <span role="alert" className="mt-1 text-[12px] text-attn-ink">
          {error}
        </span>
      ) : null}
    </span>
  );
}

/** "I'll do it" on a to-do nobody has taken. */
export function ClaimButton({ circleId, id }: { circleId: string; id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-col items-end">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setError(null);
          start(async () => {
            const result = await claimTodoAction({ circleId, id });
            if (!result.ok) setError(result.error);
            router.refresh();
          });
        }}
        className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary-700 px-2.5 text-[12px] font-semibold text-white hover:bg-primary-900 disabled:opacity-50"
      >
        <Hand className="size-3.5" aria-hidden="true" /> {pending ? "Saving" : "I'll do it"}
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
