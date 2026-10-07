"use client";
import { CalendarCheck, Eye, FileText, HelpCircle, Info, NotebookPen, Pill, Stethoscope } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useState } from "react";
import { ButtonLink } from "@/components/Button";
import { EmptyNote, inputClass, MedRow, SectionCard, TaskRow, TextItemRow } from "@/components/review/parts";
import { SourceRail, SourceSheet } from "@/components/review/SourcePanel";
import { StepHeader } from "@/components/StepHeader";
import { useToast } from "@/components/Toast";
import { COPY } from "@/lib/copy";
import { classifyMedication } from "@/lib/parse/medications";
import { makeTask } from "@/lib/parse/tasks";
import { itemId } from "@/lib/parse/util";
import type { HandoffDraft, MedicationChange, Task } from "@/lib/schema";
import { activeSections, useFlow, type SectionKey } from "@/lib/store";

type ListKey = "medications" | "tasks" | "watchFor" | "questions" | "otherNotes";

const SECTION_NAMES: Record<SectionKey, string> = {
  visit: "Visit",
  medications: "Medication changes",
  tasks: "What needs to happen next",
  watchFor: "Watch for",
  questions: "Questions for next visit",
  otherNotes: "Other notes",
};

export default function ReviewPage() {
  const router = useRouter();
  const toast = useToast();
  const { draft, reviewed, isSample, unsorted, recipients, updateDraft, setReviewed } = useFlow();
  const [hydrated, setHydrated] = useState(false);
  const [query, setQuery] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [newItem, setNewItem] = useState<string | null>(null);
  const nameListId = useId();
  const visitIds = { name: useId(), date: useId(), provider: useId(), specialty: useId(), reason: useId(), summary: useId() };

  useEffect(() => {
    // zustand persist rehydrates from sessionStorage after mount.
    const done = useFlow.persist.hasHydrated();
    if (done) setHydrated(true);
    return useFlow.persist.onFinishHydration(() => setHydrated(true));
  }, []);

  useEffect(() => {
    if (hydrated && !draft) router.replace("/new");
  }, [hydrated, draft, router]);

  const sections = useMemo(() => activeSections(draft), [draft]);
  const doneCount = sections.filter((k) => reviewed[k]).length;
  const allDone = doneCount === sections.length;

  const names = useMemo(() => {
    const set = new Set<string>();
    recipients.forEach((r) => r.name && set.add(r.name));
    draft?.tasks.forEach((t) => t.assignee && set.add(t.assignee));
    return [...set];
  }, [recipients, draft]);

  if (!hydrated || !draft) {
    return <p className="py-20 text-center text-ink-500">Loading the draft…</p>;
  }

  const set = (fn: (d: HandoffDraft) => HandoffDraft) => updateDraft(fn);

  /** Delete with a 4-second Undo toast. */
  function remove<K extends ListKey>(key: K, index: number) {
    const list = draft![key] as unknown[];
    const item = list[index];
    set((d) => ({ ...d, [key]: (d[key] as unknown[]).filter((_, i) => i !== index) }));
    toast({
      message: COPY.removed,
      actionLabel: "Undo",
      onAction: () =>
        set((d) => {
          const next = (d[key] as unknown[]).slice();
          next.splice(Math.min(index, next.length), 0, item);
          return { ...d, [key]: next };
        }),
    });
  }

  function replaceAt<K extends ListKey>(key: K, index: number, value: HandoffDraft[K][number]) {
    set((d) => ({ ...d, [key]: (d[key] as unknown[]).map((x, i) => (i === index ? value : x)) }));
  }

  function addMed() {
    const m: MedicationChange = { id: itemId("med"), kind: "new", name: "", detail: "", origin: "caregiver", confidence: "high" };
    setNewItem(m.id);
    set((d) => ({ ...d, medications: [...d.medications, m] }));
  }
  function addTask() {
    const t: Task = { id: itemId("task"), title: "", category: "home", origin: "caregiver", confidence: "high" };
    setNewItem(t.id);
    set((d) => ({ ...d, tasks: [...d.tasks, t] }));
  }
  function addText(key: "watchFor" | "questions") {
    setNewItem(`${key}-${draft![key].length}`);
    set((d) => ({ ...d, [key]: [...d[key], ""] }));
  }

  /** Other notes: "Move to..." Medications, Next steps, Watch for, Questions. */
  function moveNote(index: number, to: "medications" | "tasks" | "watchFor" | "questions") {
    const note = draft!.otherNotes[index];
    set((d) => {
      const otherNotes = d.otherNotes.filter((_, i) => i !== index);
      if (to === "medications") {
        const parsed = classifyMedication(note, true);
        const med: MedicationChange = parsed
          ? { ...parsed, sourceQuote: note, confidence: "high" }
          : { id: itemId("med"), kind: "continue", name: note.slice(0, 60), detail: note, sourceQuote: note, confidence: "high" };
        return { ...d, otherNotes, medications: [...d.medications, med] };
      }
      if (to === "tasks") return { ...d, otherNotes, tasks: [...d.tasks, makeTask(note, true, note)] };
      return { ...d, otherNotes, [to]: [...d[to], note] };
    });
    setReviewed(to, false);
    toast({ message: `Moved to ${SECTION_NAMES[to]}.` });
  }

  /** Highlight the item's sentence in the original summary (rail on desktop, sheet on phones). */
  const showSource = (quote: string) => {
    setQuery(quote);
    if (window.matchMedia("(max-width: 1023px)").matches) setSheetOpen(true);
  };

  const lowMeds = draft.medications.some((m) => m.confidence === "low");
  const lowTasks = draft.tasks.some((t) => t.confidence === "low");
  const blocked = "Accept or edit the items marked Please check this first.";
  const v = draft.visit;

  return (
    <div>
      <div className="mx-auto max-w-[720px] lg:mx-0 lg:max-w-none">
        <StepHeader current="Review" />
      </div>
      <div className="flex gap-6">
        <div className="mx-auto w-full max-w-[720px] min-w-0 lg:mx-0 lg:flex-1">
          <h1 className="font-display text-[2.1rem] leading-tight font-medium text-primary-900">Review the draft</h1>
          <p className="mt-2 text-ink-500">Nothing is shared until you confirm each section. Edit anything that looks wrong.</p>

          {isSample ? (
            <div className="mt-4 flex gap-3 rounded-xl bg-sky-100 px-4 py-3 text-primary-900">
              <Info size={20} className="mt-0.5 shrink-0" aria-hidden="true" />
              <p>
                This is a sample visit for Margaret, who is fictional. Check each section to continue, or{" "}
                <Link href="/h/demo" className="font-medium text-primary-700 underline underline-offset-4">
                  see the finished handoff page
                </Link>
                .
              </p>
            </div>
          ) : null}
          {unsorted ? (
            <p role="status" className="mt-4 rounded-xl bg-med-bg px-4 py-3 text-med-ink">
              {COPY.nothingParsed}
            </p>
          ) : null}

          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg border border-border-200 bg-white px-3 font-medium text-primary-700 lg:hidden"
          >
            <FileText size={18} aria-hidden="true" /> Show the original summary
          </button>

          <datalist id={nameListId}>
            {names.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>

          <div className="mt-6 space-y-5">
            <SectionCard
              id="visit"
              icon={<Stethoscope size={20} />}
              title="Visit"
              tone="sky"
              reviewed={!!reviewed.visit}
              onReviewed={(x) => setReviewed("visit", x)}
              canReview
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <Field id={visitIds.name} label="Who the visit was for (first name)">
                  <input
                    id={visitIds.name}
                    value={v.patientFirstName ?? ""}
                    maxLength={60}
                    onChange={(e) => set((d) => ({ ...d, visit: { ...d.visit, patientFirstName: e.target.value || undefined } }))}
                    className={inputClass}
                  />
                </Field>
                <Field id={visitIds.date} label="Visit date">
                  <input
                    id={visitIds.date}
                    type="date"
                    value={v.date ?? ""}
                    onChange={(e) => set((d) => ({ ...d, visit: { ...d.visit, date: e.target.value || undefined } }))}
                    className={`h-[2.75rem] ${inputClass}`}
                  />
                </Field>
                <Field id={visitIds.provider} label="Clinician">
                  <input
                    id={visitIds.provider}
                    value={v.provider ?? ""}
                    maxLength={120}
                    onChange={(e) => set((d) => ({ ...d, visit: { ...d.visit, provider: e.target.value || undefined } }))}
                    className={inputClass}
                  />
                </Field>
                <Field id={visitIds.specialty} label="Specialty">
                  <input
                    id={visitIds.specialty}
                    value={v.specialty ?? ""}
                    maxLength={120}
                    onChange={(e) => set((d) => ({ ...d, visit: { ...d.visit, specialty: e.target.value || undefined } }))}
                    className={inputClass}
                  />
                </Field>
                <div className="sm:col-span-2">
                  <Field id={visitIds.reason} label="Reason for the visit">
                    <input
                      id={visitIds.reason}
                      value={v.reason ?? ""}
                      maxLength={300}
                      onChange={(e) => set((d) => ({ ...d, visit: { ...d.visit, reason: e.target.value || undefined } }))}
                      className={inputClass}
                    />
                  </Field>
                </div>
                <div className="sm:col-span-2">
                  <Field id={visitIds.summary} label="Short summary">
                    <textarea
                      id={visitIds.summary}
                      rows={4}
                      value={v.summary}
                      maxLength={2000}
                      placeholder="In one or two sentences: why the visit happened and what the clinic decided."
                      onChange={(e) => set((d) => ({ ...d, visit: { ...d.visit, summary: e.target.value } }))}
                      className={inputClass}
                    />
                  </Field>
                  <p className="mt-1 text-sm text-ink-500">
                    {wordCount(v.summary)} of 60 words{wordCount(v.summary) > 60 ? ". Try to keep it short." : ""}
                  </p>
                </div>
              </div>
            </SectionCard>

            <SectionCard
              id="medications"
              icon={<Pill size={20} />}
              title="Medication changes"
              count={draft.medications.length}
              reviewed={!!reviewed.medications}
              onReviewed={(x) => setReviewed("medications", x)}
              canReview={!lowMeds}
              blockedReason={blocked}
              onAdd={addMed}
              addLabel="Add a medicine"
            >
              {draft.medications.length ? (
                <ul>
                  {draft.medications.map((m, i) => (
                    <MedRow
                      key={m.id}
                      med={m}
                      autoEdit={newItem === m.id}
                      onFocusItem={() => setQuery(m.sourceQuote ?? m.name)}
                      onShowSource={showSource}
                      onChange={(next) => replaceAt("medications", i, next)}
                      onDelete={() => remove("medications", i)}
                    />
                  ))}
                </ul>
              ) : (
                <EmptyNote />
              )}
            </SectionCard>

            <SectionCard
              id="tasks"
              icon={<CalendarCheck size={20} />}
              title="What needs to happen next"
              count={draft.tasks.length}
              reviewed={!!reviewed.tasks}
              onReviewed={(x) => setReviewed("tasks", x)}
              canReview={!lowTasks}
              blockedReason={blocked}
              onAdd={addTask}
              addLabel="Add a task"
            >
              {draft.tasks.length ? (
                <ul>
                  {draft.tasks.map((t, i) => (
                    <TaskRow
                      key={t.id}
                      task={t}
                      nameListId={nameListId}
                      autoEdit={newItem === t.id}
                      onFocusItem={() => setQuery(t.sourceQuote ?? t.title)}
                      onShowSource={showSource}
                      onChange={(next) => replaceAt("tasks", i, next)}
                      onDelete={() => remove("tasks", i)}
                    />
                  ))}
                </ul>
              ) : (
                <EmptyNote />
              )}
            </SectionCard>

            <SectionCard
              id="watchFor"
              icon={<Eye size={20} />}
              title="Watch for"
              count={draft.watchFor.length}
              reviewed={!!reviewed.watchFor}
              onReviewed={(x) => setReviewed("watchFor", x)}
              canReview
              onAdd={() => addText("watchFor")}
            >
              {draft.watchFor.length ? (
                <ul>
                  {draft.watchFor.map((w, i) => (
                    <TextItemRow
                      key={`${i}-${w}`}
                      value={w}
                      label="Watch-for item"
                      autoEdit={newItem === `watchFor-${i}` && !w}
                      onFocusItem={() => setQuery(w)}
                      onSave={(x) => replaceAt("watchFor", i, x)}
                      onDelete={() => (w ? remove("watchFor", i) : set((d) => ({ ...d, watchFor: d.watchFor.filter((_, j) => j !== i) })))}
                    />
                  ))}
                </ul>
              ) : (
                <EmptyNote />
              )}
            </SectionCard>

            <SectionCard
              id="questions"
              icon={<HelpCircle size={20} />}
              title="Questions for next visit"
              count={draft.questions.length}
              reviewed={!!reviewed.questions}
              onReviewed={(x) => setReviewed("questions", x)}
              canReview
              onAdd={() => addText("questions")}
            >
              {draft.questions.length ? (
                <ul>
                  {draft.questions.map((q, i) => (
                    <TextItemRow
                      key={`${i}-${q}`}
                      value={q}
                      label="Question"
                      autoEdit={newItem === `questions-${i}` && !q}
                      onFocusItem={() => setQuery(q)}
                      onSave={(x) => replaceAt("questions", i, x)}
                      onDelete={() => (q ? remove("questions", i) : set((d) => ({ ...d, questions: d.questions.filter((_, j) => j !== i) })))}
                    />
                  ))}
                </ul>
              ) : (
                <EmptyNote />
              )}
            </SectionCard>

            {draft.otherNotes.length ? (
              <SectionCard
                id="otherNotes"
                icon={<NotebookPen size={20} />}
                title="Other notes"
                count={draft.otherNotes.length}
                reviewed={!!reviewed.otherNotes}
                onReviewed={(x) => setReviewed("otherNotes", x)}
                canReview
              >
                <p className="mb-2 text-sm text-ink-500">
                  Lines we could not place. Move each one to a section, delete it, or leave it here and it will be shown under Other notes.
                </p>
                <ul>
                  {draft.otherNotes.map((n, i) => (
                    <TextItemRow
                      key={`${i}-${n}`}
                      value={n}
                      label="Note"
                      onFocusItem={() => setQuery(n)}
                      onSave={(x) => replaceAt("otherNotes", i, x)}
                      onDelete={() => remove("otherNotes", i)}
                      extra={<MoveTo onMove={(to) => moveNote(i, to)} />}
                    />
                  ))}
                </ul>
              </SectionCard>
            ) : null}
          </div>
        </div>
        <SourceRail source={draft.sourceText} query={query} />
      </div>

      <SourceSheet open={sheetOpen} onClose={() => setSheetOpen(false)} source={draft.sourceText} query={query} />

      {/* ConfirmBar */}
      <div
        key={allDone ? "done" : "pending"}
        className={`no-print fixed inset-x-0 bottom-0 z-20 border-t border-border-200 bg-white shadow-[0_-4px_16px_rgb(27_42_65/0.08)] ${allDone ? "animate-slide-up" : ""}`}
      >
        <div className="mx-auto flex max-w-[1100px] flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-ink-500" aria-live="polite">
            <span className="font-semibold text-ink-900">
              {doneCount} of {sections.length}
            </span>{" "}
            sections reviewed{allDone ? "" : `. ${COPY.confirmIncomplete(sections.length)}.`}
          </p>
          {allDone ? (
            <ButtonLink href="/new/share" className="w-full sm:w-auto">
              Confirm and create handoff
            </ButtonLink>
          ) : (
            <button type="button" disabled className="min-h-12 w-full cursor-not-allowed rounded-xl bg-primary-700 px-5 font-semibold text-white opacity-50 sm:w-auto">
              Confirm and create handoff
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-ink-900">
        {label}
      </label>
      {children}
    </div>
  );
}

function MoveTo({ onMove }: { onMove: (to: "medications" | "tasks" | "watchFor" | "questions") => void }) {
  const id = useId();
  return (
    <div className="mt-1.5">
      <label htmlFor={id} className="sr-only">
        Move this note to a section
      </label>
      <select
        id={id}
        value=""
        onChange={(e) => {
          if (e.target.value) onMove(e.target.value as "medications" | "tasks" | "watchFor" | "questions");
        }}
        className="h-9 rounded-lg border border-border-200 bg-white px-2 text-sm text-primary-700"
      >
        <option value="">Move to…</option>
        <option value="medications">Medications</option>
        <option value="tasks">Next steps</option>
        <option value="watchFor">Watch for</option>
        <option value="questions">Questions</option>
      </select>
    </div>
  );
}

function wordCount(s: string) {
  return s.trim() ? s.trim().split(/\s+/).length : 0;
}
