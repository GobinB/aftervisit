"use client";

import { Pencil, Plus, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { deleteVisitAction, updateVisitAction } from "@/app/actions/visits";
import { MAX_VISIT_LINES, visitLines, type VisitView } from "@/lib/schema/visits";

const field = "block w-full rounded-lg border border-border-200 bg-white px-3 py-2.5 text-[16px] text-ink-900 outline-none focus:border-action-500 focus:ring-2 focus:ring-action-500/30";

type ListKey = "watchFor" | "goodToKnow" | "questions";
const LISTS: { key: ListKey; title: string; add: string; item: string }[] = [
  { key: "watchFor", title: "Watch for", add: "Add something to watch for", item: "Watch-for item" },
  { key: "goodToKnow", title: "Good to know", add: "Add something good to know", item: "Good-to-know item" },
  { key: "questions", title: "Questions for the next visit", add: "Add a question", item: "Question" },
];

/**
 * The caregiver fixes a saved visit's notes: change the summary, change or remove a line, add one.
 * Closed until "Change these notes" is tapped, so the page reads as notes, not as a form.
 */
export function EditVisit({ circleId, visit }: { circleId: string; visit: VisitView }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState(visit.summary ?? "");
  const [visitDate, setVisitDate] = useState(visit.visitDate ?? "");
  const [lists, setLists] = useState<Record<ListKey, string[]>>({ watchFor: visit.watchFor, goodToKnow: visit.goodToKnow, questions: visit.questions ?? [] });

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-12 items-center gap-2 rounded-lg border border-border-200 bg-white px-4 text-[15px] font-semibold text-primary-700 hover:bg-sky-100"
      >
        <Pencil className="size-5" aria-hidden="true" /> Change these notes
      </button>
    );
  }

  const setLine = (key: ListKey, index: number, value: string) => setLists({ ...lists, [key]: lists[key].map((line, i) => (i === index ? value : line)) });
  const save = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    start(async () => {
      const result = await updateVisitAction({
        circleId,
        id: visit.id,
        visitDate,
        content: {
          clinic: visit.clinic,
          provider: visit.provider,
          specialty: visit.specialty,
          reason: visit.reason,
          summary,
          watchFor: visitLines(lists.watchFor),
          goodToKnow: visitLines(lists.goodToKnow),
          questions: visitLines(lists.questions),
        },
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOpen(false);
    });
  };

  return (
    <form onSubmit={save} className="space-y-5 rounded-lg border border-border-200 bg-white p-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-[12rem_1fr]">
        <div>
          <label htmlFor={`${id}-date`} className="mb-1 block text-[14px] font-semibold text-ink-900">
            Visit date
          </label>
          <input id={`${id}-date`} type="date" value={visitDate} onChange={(event) => setVisitDate(event.target.value)} className={`h-12 ${field}`} />
        </div>
        <div>
          <label htmlFor={`${id}-summary`} className="mb-1 block text-[14px] font-semibold text-ink-900">
            Short summary
          </label>
          <textarea id={`${id}-summary`} rows={3} maxLength={2000} value={summary} onChange={(event) => setSummary(event.target.value)} className={field} />
        </div>
      </div>
      {LISTS.map((list) => (
        <fieldset key={list.key}>
          <legend className="mb-1 text-[14px] font-semibold text-ink-900">{list.title}</legend>
          <ul className="space-y-2">
            {lists[list.key].map((line, index) => (
              <li key={index} className="flex items-start gap-2">
                <input
                  aria-label={`${list.item} ${index + 1}`}
                  value={line}
                  maxLength={1000}
                  onChange={(event) => setLine(list.key, index, event.target.value)}
                  className={`h-12 ${field}`}
                />
                <button
                  type="button"
                  onClick={() => setLists({ ...lists, [list.key]: lists[list.key].filter((_, i) => i !== index) })}
                  aria-label={`Remove ${list.item.toLowerCase()} ${index + 1}`}
                  className="inline-flex size-12 shrink-0 items-center justify-center rounded-lg border border-border-200 bg-white text-ink-500 hover:bg-attn-bg hover:text-attn-ink"
                >
                  <X className="size-5" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
          {lists[list.key].length < MAX_VISIT_LINES ? (
            <button
              type="button"
              onClick={() => setLists({ ...lists, [list.key]: [...lists[list.key], ""] })}
              className="mt-1.5 inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-[15px] font-semibold text-primary-700 hover:bg-sky-100"
            >
              <Plus className="size-4" aria-hidden="true" /> {list.add}
            </button>
          ) : null}
        </fieldset>
      ))}
      {error ? (
        <p role="alert" className="rounded-md bg-attn-bg px-3 py-2 text-[14px] text-attn-ink">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={pending} className="inline-flex min-h-12 items-center rounded-lg bg-primary-700 px-5 text-[15px] font-semibold text-white hover:bg-primary-900 disabled:opacity-50">
          {pending ? "Saving" : "Save the notes"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="inline-flex min-h-12 items-center rounded-lg px-4 text-[15px] font-semibold text-ink-500 hover:bg-paper-100">
          Cancel
        </button>
      </div>
    </form>
  );
}

/** Deletes a visit's notes for good, after one plain question. What the visit changed in the circle stays. */
export function DeleteVisit({ circleId, id }: { circleId: string; id: string }) {
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (!asking) {
    return (
      <button
        type="button"
        onClick={() => setAsking(true)}
        className="inline-flex min-h-12 items-center gap-2 rounded-lg border border-border-200 bg-white px-4 text-[15px] font-semibold text-attn-ink hover:bg-attn-bg"
      >
        <Trash2 className="size-5" aria-hidden="true" /> Delete these notes
      </button>
    );
  }
  return (
    <div role="group" aria-label="Confirm delete" className="w-full space-y-3 rounded-lg border border-attn/30 bg-white p-4">
      <p className="text-[15px] text-ink-900">Delete these notes for good? The medicines, reminders and appointments from this visit stay, and so do any photos you kept.</p>
      {error ? (
        <p role="alert" className="rounded-md bg-attn-bg px-3 py-2 text-[14px] text-attn-ink">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const result = await deleteVisitAction({ circleId, id });
              if (!result.ok) setError(result.error);
              else {
                router.push(`/circles/${circleId}/visits`);
              }
            })
          }
          className="inline-flex min-h-12 items-center rounded-lg border-2 border-attn bg-white px-4 text-[15px] font-semibold text-attn-ink hover:bg-attn-bg disabled:opacity-50"
        >
          {pending ? "Deleting" : "Yes, delete"}
        </button>
        <button type="button" onClick={() => setAsking(false)} className="inline-flex min-h-12 items-center rounded-lg px-4 text-[15px] font-semibold text-ink-500 hover:bg-paper-100">
          Cancel
        </button>
      </div>
    </div>
  );
}
