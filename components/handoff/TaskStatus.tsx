"use client";
import { CheckCircle2, Circle, CircleDot } from "lucide-react";
import { useId, useState } from "react";
import { dateTime } from "@/lib/format";
import { TASK_STATUS_LABELS, TASK_STATUSES, type TaskStatusValue, type TaskStatusView } from "@/lib/schema";

const STYLE: Record<TaskStatusValue, { cls: string; icon: typeof Circle }> = {
  not_started: { cls: "bg-surface-50 text-ink-500 ring-1 ring-border-200", icon: Circle },
  in_progress: { cls: "bg-sky-100 text-primary-900", icon: CircleDot },
  completed: { cls: "bg-ok-bg text-ok-ink", icon: CheckCircle2 },
};

export function StatusChip({ status }: { status: TaskStatusValue }) {
  const { cls, icon: Icon } = STYLE[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${cls}`}>
      <Icon size={13} aria-hidden="true" />
      {TASK_STATUS_LABELS[status]}
    </span>
  );
}

/** "Marked completed by Lisa through Lisa's personal link, Oct 8, 9:15 AM." */
export function Attribution({ s }: { s?: TaskStatusView }) {
  if (!s?.updatedAt || !s.updatedByName) return null;
  const verb = s.status === "completed" ? "Marked completed" : s.status === "in_progress" ? "Marked in progress" : "Reset to not started";
  const who = s.updatedVia === "personal_link" ? `${s.updatedByName} through ${s.updatedByName}'s personal link` : `${s.updatedByName}, who shared this`;
  return (
    <p className="mt-1 text-xs text-ink-500">
      {verb} by {who}, {dateTime(s.updatedAt)}.
      {s.note ? <span className="mt-0.5 block text-sm text-ink-900/85">Note: {s.note}</span> : null}
    </p>
  );
}

/**
 * Status controls for a step the viewer may update. Saves status and an optional note together.
 */
export function TaskStatusControl({
  taskTitle,
  value,
  onSave,
}: {
  taskTitle: string;
  value: TaskStatusView;
  onSave: (status: TaskStatusValue, note?: string) => Promise<{ ok: true } | { ok: false; message: string }>;
}) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<TaskStatusValue | null>(null);
  const [error, setError] = useState<string | null>(null);
  const noteId = useId();

  async function save(status: TaskStatusValue) {
    setBusy(status);
    setError(null);
    const r = await onSave(status, note || undefined);
    setBusy(null);
    if (!r.ok) setError(r.message);
    else setNote("");
  }

  return (
    <div className="no-print mt-3 rounded-xl border border-border-200 bg-surface-50 p-3">
      <p className="text-sm font-medium" id={`${noteId}-label`}>
        Update this step
      </p>
      <div role="group" aria-labelledby={`${noteId}-label`} className="mt-2 flex flex-wrap gap-1.5">
        {TASK_STATUSES.map((s) => {
          const on = value.status === s;
          return (
            <button
              key={s}
              type="button"
              aria-pressed={on}
              aria-label={`${TASK_STATUS_LABELS[s]}: ${taskTitle}`}
              disabled={busy !== null}
              onClick={() => save(s)}
              className={`min-h-11 rounded-lg px-3.5 text-sm font-semibold whitespace-nowrap transition-colors disabled:opacity-60 ${
                on ? (s === "completed" ? "bg-ok text-white" : "bg-primary-700 text-white") : "bg-white text-primary-700 ring-1 ring-border-200 hover:bg-sky-100"
              }`}
            >
              {busy === s ? "Saving…" : TASK_STATUS_LABELS[s]}
            </button>
          );
        })}
      </div>
      <label htmlFor={noteId} className="mt-3 block text-sm text-ink-500">
        Add a note (optional), then choose a status
      </label>
      <input
        id={noteId}
        value={note}
        maxLength={300}
        onChange={(e) => setNote(e.target.value)}
        placeholder="For example: appointment booked for Oct 15"
        className="mt-1 h-11 w-full rounded-lg border border-border-200 bg-white px-3 outline-none focus:border-action-500 focus:ring-2 focus:ring-action-500/30"
      />
      {error ? (
        <p role="alert" className="mt-2 text-sm text-attn-ink">
          {error}
        </p>
      ) : null}
    </div>
  );
}
