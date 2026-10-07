"use client";
import { Check, FileSearch, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Badge, MED_KIND_LABEL } from "@/components/Badge";
import { COPY } from "@/lib/copy";
import { MED_KINDS, type MedicationChange, type Task } from "@/lib/schema";

export const inputClass =
  "w-full rounded-lg border border-border-200 bg-white px-3 py-2 text-base outline-none focus:border-action-500 focus:ring-2 focus:ring-action-500/30";

/** White card, 16 px radius, 20 px padding. Border turns green once reviewed. */
export function SectionCard({
  id,
  icon,
  title,
  count,
  reviewed,
  onReviewed,
  canReview,
  blockedReason,
  onAdd,
  addLabel = "Add item",
  tone = "default",
  children,
}: {
  id: string;
  icon: ReactNode;
  title: string;
  count?: number;
  reviewed: boolean;
  onReviewed: (v: boolean) => void;
  canReview: boolean;
  blockedReason?: string;
  onAdd?: () => void;
  addLabel?: string;
  tone?: "default" | "sky";
  children: ReactNode;
}) {
  const checkId = useId();
  return (
    <section
      aria-labelledby={`${id}-title`}
      className={`animate-fade-in rounded-2xl border-2 p-5 transition-colors ${
        reviewed ? "border-ok" : "border-border-200"
      } ${tone === "sky" ? "bg-sky-100" : "bg-white"}`}
    >
      <h2 id={`${id}-title`} className="flex items-center gap-2 text-xl font-semibold text-primary-700">
        <span className="text-primary-700" aria-hidden="true">
          {icon}
        </span>
        {title}
        {count !== undefined ? <span className="text-base font-normal text-ink-500">({count})</span> : null}
      </h2>
      <div className="mt-3">{children}</div>
      <div className="mt-4 flex flex-col gap-3 border-t border-border-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
        {onAdd ? (
          <button type="button" onClick={onAdd} className="inline-flex min-h-10 items-center gap-1.5 self-start rounded-lg px-2 font-medium text-primary-700 hover:bg-sky-100">
            <Plus size={18} aria-hidden="true" /> {addLabel}
          </button>
        ) : (
          <span />
        )}
        <div>
          <label
            htmlFor={checkId}
            className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-1 font-medium ${canReview ? "text-ink-900" : "cursor-not-allowed text-ink-500"}`}
          >
            <span className="relative inline-flex h-7 w-7 shrink-0">
              <input
                id={checkId}
                type="checkbox"
                checked={reviewed}
                disabled={!canReview && !reviewed}
                onChange={(e) => onReviewed(e.target.checked)}
                aria-describedby={!canReview && blockedReason ? `${checkId}-why` : undefined}
                className="peer h-7 w-7 cursor-pointer appearance-none rounded-md border-2 border-border-200 bg-white checked:border-ok checked:bg-ok disabled:cursor-not-allowed"
              />
              <Check size={18} strokeWidth={3} className="pointer-events-none absolute top-1/2 left-1/2 hidden -translate-x-1/2 -translate-y-1/2 text-white peer-checked:block" aria-hidden="true" />
            </span>
            {COPY.sectionReviewed}
          </label>
          {!canReview && blockedReason ? (
            <p id={`${checkId}-why`} className="text-sm text-med-ink sm:text-right">
              {blockedReason}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export function EmptyNote() {
  return <p className="text-ink-500">{COPY.emptySection}</p>;
}

function RowActions({ label, onEdit, onDelete }: { label: string; onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="flex shrink-0 gap-0.5 opacity-100 transition-opacity md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100">
      <button type="button" onClick={onEdit} className="rounded-lg p-2.5 text-ink-500 hover:bg-sky-100 hover:text-primary-700" aria-label={`Edit ${label}`}>
        <Pencil size={18} aria-hidden="true" />
      </button>
      <button type="button" onClick={onDelete} className="rounded-lg p-2.5 text-ink-500 hover:bg-attn-bg hover:text-attn-ink" aria-label={`Delete ${label}`}>
        <Trash2 size={18} aria-hidden="true" />
      </button>
    </div>
  );
}

/** "View original instruction" for items from the summary; a label for items the caregiver added. */
export function SourceLink({ quote, added, onShow }: { quote?: string; added?: boolean; onShow?: (q: string) => void }) {
  if (added) return <p className="mt-1.5 text-xs font-semibold tracking-wide text-ink-500 uppercase">Added by you, not in the summary</p>;
  if (!quote || !onShow) return null;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onShow(quote);
      }}
      className="mt-1.5 inline-flex min-h-9 items-center gap-1.5 rounded-lg px-1 text-sm font-medium text-primary-700 underline decoration-primary-700/30 underline-offset-4 hover:decoration-primary-700"
    >
      <FileSearch size={16} aria-hidden="true" /> View original instruction
    </button>
  );
}

function LowConfidence({ onAccept }: { onAccept: () => void }) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
      <Badge tone="med">{COPY.lowConfidenceBadge}</Badge>
      <span className="text-sm text-ink-500">{COPY.lowConfidenceHelper}</span>
      <button type="button" onClick={onAccept} className="min-h-9 rounded-lg border border-med px-3 text-sm font-semibold text-med-ink hover:bg-med-bg">
        Accept
      </button>
    </div>
  );
}

/** Plain text item (Watch for, Questions). Click to edit, Enter to save. */
export function TextItemRow({
  value,
  onSave,
  onDelete,
  onFocusItem,
  autoEdit,
  label,
  extra,
}: {
  value: string;
  onSave: (v: string) => void;
  onDelete: () => void;
  onFocusItem?: () => void;
  autoEdit?: boolean;
  label: string;
  extra?: ReactNode;
}) {
  const [editing, setEditing] = useState(!!autoEdit);
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);

  const save = () => {
    const v = draft.trim();
    if (!v) onDelete();
    else onSave(v);
    setEditing(false);
  };

  if (editing) {
    return (
      <li className="py-2">
        <textarea
          aria-label={label}
          value={draft}
          autoFocus
          rows={Math.min(4, Math.max(1, Math.ceil(draft.length / 48)))}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              save();
            } else if (e.key === "Escape") {
              if (!value) onDelete();
              setDraft(value);
              setEditing(false);
            }
          }}
          onBlur={save}
          className={inputClass}
        />
      </li>
    );
  }
  return (
    <li className="group flex items-start gap-2 border-b border-border-200/70 py-2 last:border-0" onClick={onFocusItem}>
      <div className="min-w-0 flex-1 pt-2">
        <button type="button" className="w-full cursor-text text-left" onClick={() => setEditing(true)} onFocus={onFocusItem}>
          {value}
        </button>
        {extra}
      </div>
      <RowActions label={label} onEdit={() => setEditing(true)} onDelete={onDelete} />
    </li>
  );
}

export function MedRow({
  med,
  onChange,
  onDelete,
  onFocusItem,
  onShowSource,
  autoEdit,
}: {
  med: MedicationChange;
  onChange: (m: MedicationChange) => void;
  onDelete: () => void;
  onFocusItem?: () => void;
  onShowSource?: (quote: string) => void;
  autoEdit?: boolean;
}) {
  const [editing, setEditing] = useState(!!autoEdit);
  const [form, setForm] = useState(med);
  const ids = { name: useId(), kind: useId(), detail: useId() };
  useEffect(() => setForm(med), [med]);

  const save = () => {
    if (!form.name.trim() && !form.detail.trim()) return onDelete();
    onChange({ ...form, name: form.name.trim() || "Medicine", detail: form.detail.trim(), confidence: "high" });
    setEditing(false);
  };

  if (editing) {
    return (
      <li className="rounded-xl bg-surface-50 p-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              if (!med.name && !med.detail) onDelete();
              setForm(med);
              setEditing(false);
            }
          }}
          className="grid gap-3 sm:grid-cols-[1fr_12rem]"
        >
          <div>
            <label htmlFor={ids.name} className="text-sm font-medium">
              Medicine
            </label>
            <input id={ids.name} autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={`mt-1 ${inputClass}`} />
          </div>
          <div>
            <label htmlFor={ids.kind} className="text-sm font-medium">
              Change
            </label>
            <select
              id={ids.kind}
              value={form.kind}
              onChange={(e) => setForm({ ...form, kind: e.target.value as MedicationChange["kind"] })}
              className={`mt-1 h-[2.75rem] ${inputClass}`}
            >
              {MED_KINDS.map((k) => (
                <option key={k} value={k}>
                  {MED_KIND_LABEL[k]}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label htmlFor={ids.detail} className="text-sm font-medium">
              How to take it
            </label>
            <input id={ids.detail} value={form.detail} onChange={(e) => setForm({ ...form, detail: e.target.value })} className={`mt-1 ${inputClass}`} />
          </div>
          <div className="flex gap-2 sm:col-span-2">
            <button type="submit" className="min-h-11 rounded-lg bg-primary-700 px-4 font-semibold text-white">
              Save
            </button>
            <button
              type="button"
              className="min-h-11 rounded-lg px-4 font-medium text-primary-700 hover:bg-sky-100"
              onClick={() => {
                if (!med.name && !med.detail) onDelete();
                setForm(med);
                setEditing(false);
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className="group flex flex-wrap items-start gap-2 border-b border-border-200/70 py-3 last:border-0" onClick={onFocusItem}>
      <button type="button" className="min-w-0 flex-1 cursor-text text-left" onClick={() => setEditing(true)} onFocus={onFocusItem}>
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{med.name}</span>
          <Badge tone={med.kind === "continue" ? "muted" : med.kind === "stopped" ? "attn" : "med"}>{MED_KIND_LABEL[med.kind]}</Badge>
        </span>
        <span className="mt-0.5 block text-ink-900/85">{med.detail}</span>
        {med.reason ? <span className="block text-sm text-ink-500">For: {med.reason}</span> : null}
      </button>
      <RowActions label={med.name || "medicine"} onEdit={() => setEditing(true)} onDelete={onDelete} />
      <div className="basis-full">
        <SourceLink quote={med.sourceQuote} added={med.origin === "caregiver"} onShow={onShowSource} />
      </div>
      {med.confidence === "low" ? (
        <div className="basis-full">
          <LowConfidence onAccept={() => onChange({ ...med, confidence: "high" })} />
        </div>
      ) : null}
    </li>
  );
}

const CATEGORY_LABEL: Record<Task["category"], string> = {
  appointment: "Appointment",
  referral: "Referral",
  lab: "Lab or test",
  pharmacy: "Pharmacy",
  home: "At home",
  other: "Other",
};
export { CATEGORY_LABEL };

export function TaskRow({
  task,
  onChange,
  onDelete,
  onFocusItem,
  onShowSource,
  autoEdit,
  nameListId,
}: {
  task: Task;
  onChange: (t: Task) => void;
  onDelete: () => void;
  onFocusItem?: () => void;
  onShowSource?: (quote: string) => void;
  autoEdit?: boolean;
  nameListId: string;
}) {
  const [editing, setEditing] = useState(!!autoEdit);
  const [title, setTitle] = useState(task.title);
  const ids = { who: useId(), when: useId() };
  const titleRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => setTitle(task.title), [task.title]);

  const saveTitle = () => {
    const v = title.trim();
    if (!v) return onDelete();
    onChange({ ...task, title: v, confidence: "high" });
    setEditing(false);
  };

  return (
    <li className="group border-b border-border-200/70 py-3 last:border-0" onClick={onFocusItem}>
      <div className="flex items-start gap-2">
        {editing ? (
          <textarea
            ref={titleRef}
            aria-label="Task"
            autoFocus
            value={title}
            rows={Math.min(4, Math.max(1, Math.ceil(title.length / 48)))}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                saveTitle();
              } else if (e.key === "Escape") {
                if (!task.title) onDelete();
                setTitle(task.title);
                setEditing(false);
              }
            }}
            onBlur={saveTitle}
            className={`flex-1 ${inputClass}`}
          />
        ) : (
          <button type="button" className="min-w-0 flex-1 cursor-text text-left" onClick={() => setEditing(true)} onFocus={onFocusItem}>
            <span className="text-xs font-semibold uppercase tracking-wider text-ink-500">{CATEGORY_LABEL[task.category]}</span>
            <span className="block">{task.title}</span>
            {task.dueText ? <span className="block text-sm text-ink-500">When: {task.dueText}</span> : null}
          </button>
        )}
        {!editing ? <RowActions label={task.title || "task"} onEdit={() => setEditing(true)} onDelete={onDelete} /> : null}
      </div>
      <SourceLink quote={task.sourceQuote} added={task.origin === "caregiver"} onShow={onShowSource} />
      <div className="mt-2 grid grid-cols-2 gap-2 sm:max-w-md">
        <div>
          <label htmlFor={ids.who} className="text-sm text-ink-500">
            Who will do this
          </label>
          <input
            id={ids.who}
            list={nameListId}
            value={task.assignee ?? ""}
            placeholder="Anyone"
            maxLength={80}
            onChange={(e) => onChange({ ...task, assignee: e.target.value || undefined })}
            className={`mt-0.5 h-10 ${inputClass} py-1`}
          />
        </div>
        <div>
          <label htmlFor={ids.when} className="text-sm text-ink-500">
            By when
          </label>
          <input
            id={ids.when}
            type="date"
            value={task.dueDate ?? ""}
            onChange={(e) => onChange({ ...task, dueDate: e.target.value || undefined })}
            className={`mt-0.5 h-10 ${inputClass} py-1`}
          />
        </div>
      </div>
      {task.confidence === "low" ? <LowConfidence onAccept={() => onChange({ ...task, confidence: "high" })} /> : null}
    </li>
  );
}
