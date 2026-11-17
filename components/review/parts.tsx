"use client";
import { Check, FileSearch, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Badge, MED_KIND_LABEL } from "@/components/Badge";
import { COPY } from "@/lib/copy";
import { unreadableLabel, type MedField } from "@/lib/extract/flags";
import { canAcceptMed, medNeedsLook, taskNeedsLook } from "@/lib/review";
import { MED_KINDS, type MedicationChange, type Task } from "@/lib/schema";

export const inputClass =
  "w-full rounded-lg border border-border-200 bg-white px-3 py-2 text-base outline-none focus:border-action-500 focus:ring-2 focus:ring-action-500/30";

/** Each section has its own colour, so the page reads as parts and not one block of words. Medicines are green. */
export type SectionTone = "meds" | "visit" | "steps" | "watch" | "know" | "ask";
const TONES: Record<SectionTone, { card: string; title: string }> = {
  meds: { card: "border-ok/50 bg-ok-bg/40 border-l-ok", title: "text-ok-ink" },
  visit: { card: "border-border-200 bg-white border-l-primary-700", title: "text-primary-900" },
  steps: { card: "border-med/30 bg-med-bg/30 border-l-med", title: "text-med-ink" },
  watch: { card: "border-attn/30 bg-attn-bg/30 border-l-attn", title: "text-attn-ink" },
  know: { card: "border-know/30 bg-know-bg/60 border-l-know", title: "text-know-ink" },
  ask: { card: "border-border-200 bg-white border-l-ink-500", title: "text-ink-900" },
};

/** The "I reviewed it" button at the foot of a section, on the left. Tapped again, it takes the review back. */
export type SectionReview = { done: boolean; blocked?: string; onToggle: (done: boolean) => void };

/** One section of the draft on Review: a heading with a count, its items, and at the foot "I reviewed it" and Add. */
export function Section({
  id,
  icon,
  title,
  count,
  tone,
  review,
  onAdd,
  addLabel = "Add one",
  children,
}: {
  id: string;
  icon: ReactNode;
  title: string;
  count?: number;
  tone: SectionTone;
  review?: SectionReview;
  onAdd?: () => void;
  addLabel?: string;
  children: ReactNode;
}) {
  const colors = TONES[tone];
  return (
    <section aria-labelledby={`${id}-title`} className={`animate-fade-in scroll-mt-36 rounded-xl border border-l-4 px-4 pt-3 pb-2 ${colors.card}`}>
      <h2 id={`${id}-title`} className={`flex items-center gap-2 text-item font-semibold ${colors.title}`}>
        <span aria-hidden="true">{icon}</span>
        {title}
        {count !== undefined ? <span className="text-label font-normal text-ink-500">({count})</span> : null}
      </h2>
      <div className="mt-0.5">{children}</div>
      {review || onAdd ? (
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
          {review ? <ReviewedButton section={title} {...review} /> : null}
          {onAdd ? (
            <button type="button" onClick={onAdd} className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 font-medium text-primary-700 hover:bg-white/70">
              <Plus size={18} aria-hidden="true" /> {addLabel}
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function ReviewedButton({ section, done, blocked, onToggle }: SectionReview & { section: string }) {
  const hintId = useId();
  return (
    <span className="inline-flex flex-col">
      <button
        type="button"
        aria-pressed={done}
        aria-label={`${done ? "Reviewed" : "I reviewed it"}: ${section}`}
        aria-describedby={blocked ? hintId : undefined}
        disabled={!!blocked && !done}
        onClick={() => onToggle(!done)}
        className={`inline-flex min-h-12 items-center gap-1.5 rounded-lg border-2 px-4 text-label font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${
          done ? "border-ok bg-ok text-white hover:bg-ok-ink" : "border-ok bg-white text-ok-ink hover:bg-ok-bg"
        }`}
      >
        <Check size={18} strokeWidth={3} aria-hidden="true" /> {done ? "Reviewed" : "I reviewed it"}
      </button>
      {blocked ? (
        <span id={hintId} className="mt-1 text-hint font-medium text-med-ink">
          {blocked}
        </span>
      ) : null}
    </span>
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

/** "See it in the original" for items from the summary; a label for items the caregiver added. */
export function SourceLink({ quote, added, onShow, page }: { quote?: string; added?: boolean; onShow?: (quote: string, page?: number) => void; page?: number }) {
  if (added) return <p className="mt-1.5 text-xs font-semibold tracking-wide text-ink-500 uppercase">Added by you, not in the summary</p>;
  if (!quote || !onShow) return null;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onShow(quote, page);
      }}
      className="mt-1.5 inline-flex min-h-9 items-center gap-1.5 rounded-lg px-1 text-sm font-medium text-primary-700 underline decoration-primary-700/30 underline-offset-4 hover:decoration-primary-700"
    >
      <FileSearch size={16} aria-hidden="true" /> See it in the original{page ? ` (page ${page})` : ""}
    </button>
  );
}

/**
 * "Please check this", on an item the reader was unsure of. The caregiver looks at it by fixing it,
 * saying it is right, or deleting it. When the reader could not read part of a medicine, it says
 * which part; a medicine with no name cannot be accepted as it is, so "It's right" is not offered.
 */
function NeedsLook({
  helper,
  canAccept,
  onAccept,
  onFix,
  onDelete,
  fixLabel,
}: {
  helper: string;
  canAccept: boolean;
  onAccept: () => void;
  onFix: () => void;
  onDelete: () => void;
  fixLabel: string;
}) {
  const button = "min-h-10 rounded-lg border px-3 text-sm font-semibold";
  return (
    <div className="mt-2 rounded-xl bg-med-bg/60 px-3 py-2.5">
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <Badge tone="med">{COPY.lowConfidenceBadge}</Badge>
        <span className="text-sm text-ink-900">{helper}</span>
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" onClick={onFix} className={`${button} border-primary-700 bg-primary-700 text-white hover:bg-primary-900`}>
          {fixLabel}
        </button>
        {canAccept ? (
          <button type="button" onClick={onAccept} className={`${button} border-med bg-white text-med-ink hover:bg-med-bg`}>
            It&apos;s right
          </button>
        ) : null}
        <button type="button" onClick={onDelete} className={`${button} border-border-200 bg-white text-ink-900 hover:bg-attn-bg hover:text-attn-ink`}>
          Delete
        </button>
      </div>
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
  onShowSource?: (quote: string, page?: number) => void;
  autoEdit?: boolean;
}) {
  const [editing, setEditing] = useState(!!autoEdit);
  const [form, setForm] = useState(med);
  const [nameError, setNameError] = useState(false);
  const ids = { name: useId(), kind: useId(), detail: useId(), error: useId() };
  useEffect(() => setForm(med), [med]);

  const save = () => {
    if (!form.name.trim() && !form.detail.trim()) return onDelete();
    // A medicine is never saved without its name: the caregiver types it from the paper, or deletes the item.
    if (!canAcceptMed(form)) return setNameError(true);
    setNameError(false);
    onChange({ ...form, name: form.name.trim(), detail: form.detail.trim(), unreadable: undefined, confidence: "high" });
    setEditing(false);
  };

  if (editing) {
    return (
      <li data-item={med.id} className="rounded-xl bg-surface-50 p-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              if (!med.name && !med.detail) onDelete();
              setForm(med);
              setNameError(false);
              setEditing(false);
            }
          }}
          className="grid gap-3 sm:grid-cols-[1fr_12rem]"
        >
          <div>
            <label htmlFor={ids.name} className="text-sm font-medium">
              Medicine
            </label>
            <input
              id={ids.name}
              autoFocus={!form.name.trim() || !!form.detail.trim()}
              value={form.name}
              maxLength={300}
              aria-invalid={nameError || undefined}
              aria-describedby={nameError ? ids.error : undefined}
              onChange={(e) => {
                setForm({ ...form, name: e.target.value });
                if (e.target.value.trim()) setNameError(false);
              }}
              className={`mt-1 ${inputClass}`}
            />
            {nameError ? (
              <p id={ids.error} role="alert" className="mt-1 text-sm font-medium text-attn-ink">
                {COPY.medNameNeeded}
              </p>
            ) : null}
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
            <input
              id={ids.detail}
              autoFocus={!!form.name.trim() && !form.detail.trim()}
              value={form.detail}
              maxLength={1000}
              onChange={(e) => setForm({ ...form, detail: e.target.value })}
              className={`mt-1 ${inputClass}`}
            />
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
                setNameError(false);
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
    <li data-item={med.id} className="group flex scroll-mt-40 flex-wrap items-start gap-2 border-b border-border-200/70 py-3 last:border-0" onClick={onFocusItem}>
      <button type="button" className="min-w-0 flex-1 cursor-text text-left" onClick={() => setEditing(true)} onFocus={onFocusItem}>
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{med.name || <span className="text-ink-500 italic">Name not read</span>}</span>
          <Badge tone={med.kind === "continue" ? "muted" : med.kind === "stopped" ? "attn" : "med"}>{MED_KIND_LABEL[med.kind]}</Badge>
        </span>
        <span className="mt-0.5 block text-ink-900/85">{med.detail}</span>
        {med.reason ? <span className="block text-sm text-ink-500">For: {med.reason}</span> : null}
      </button>
      <RowActions label={med.name || "medicine"} onEdit={() => setEditing(true)} onDelete={onDelete} />
      <div className="basis-full">
        <SourceLink quote={med.sourceQuote} added={med.origin === "caregiver"} onShow={onShowSource} page={med.sourcePage} />
      </div>
      {medNeedsLook(med) ? (
        <div className="basis-full">
          <NeedsLook
            helper={
              med.unreadable?.length
                ? COPY.unreadableHelper(unreadableLabel(med.unreadable), !canAcceptMed(med))
                : canAcceptMed(med)
                  ? COPY.lowConfidenceHelper
                  : COPY.unreadableHelper(unreadableLabel(["name"] satisfies MedField[]), true)
            }
            canAccept={canAcceptMed(med)}
            onAccept={() => onChange({ ...med, unreadable: undefined, confidence: "high" })}
            onFix={() => setEditing(true)}
            onDelete={onDelete}
            fixLabel={med.unreadable?.length || !canAcceptMed(med) ? "Type it in" : "Fix it"}
          />
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
  plan = true,
}: {
  task: Task;
  onChange: (t: Task) => void;
  onDelete: () => void;
  onFocusItem?: () => void;
  onShowSource?: (quote: string, page?: number) => void;
  autoEdit?: boolean;
  nameListId: string;
  /** Who will do it, and by when. Off for a visit going into a circle: those are picked on Update. */
  plan?: boolean;
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
    <li data-item={task.id} className="group scroll-mt-40 border-b border-border-200/70 py-3 last:border-0" onClick={onFocusItem}>
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
      <SourceLink quote={task.sourceQuote} added={task.origin === "caregiver"} onShow={onShowSource} page={task.sourcePage} />
      {plan ? (
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
      ) : null}
      {taskNeedsLook(task) ? (
        <NeedsLook
          helper={COPY.lowConfidenceHelper}
          canAccept
          onAccept={() => onChange({ ...task, confidence: "high" })}
          onFix={() => setEditing(true)}
          onDelete={onDelete}
          fixLabel="Fix it"
        />
      ) : null}
    </li>
  );
}
