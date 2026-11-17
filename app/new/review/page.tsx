"use client";
import { ReaderNote } from "@/components/review/ReaderNote";
import { ArrowLeft, CalendarCheck, Eye, FileText, HelpCircle, Images, Info, Lightbulb, ListChecks, Pencil, Pill, Plus, Stethoscope } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { EmptyNote, inputClass, MedRow, Section, TaskRow, TextItemRow } from "@/components/review/parts";
import { OriginalView, type SourceTarget } from "@/components/review/SourcePanel";
import { BackLink } from "@/components/circles/PageHead";
import { StepHeader } from "@/components/StepHeader";
import { useToast } from "@/components/Toast";
import { COPY } from "@/lib/copy";
import { shortDate } from "@/lib/format";
import { itemId } from "@/lib/parse/util";
import { itemsWaiting, medNeedsLook, reviewState, type ReviewSection } from "@/lib/review";
import type { HandoffDraft, MedicationChange, Task } from "@/lib/schema";
import { getOriginalPages, useFlow } from "@/lib/store";

type ListKey = "medications" | "tasks" | "watchFor" | "questions" | "otherNotes";
type TextKey = "watchFor" | "questions" | "otherNotes";

const isPhone = () => window.matchMedia("(max-width: 1023px)").matches;

/**
 * The draft, checked against the original before anything is saved, with one button at the end:
 * "Looks right". Items the reader was unsure of must be looked at first; the button takes the
 * caregiver to each. The original sits beside the draft on a computer; on a phone the two swap.
 * The rules are in lib/review.ts.
 */
export default function ReviewPage() {
  const router = useRouter();
  const toast = useToast();
  const { draft, reviewed, isSample, unsorted, recipients, updateDraft, setReviewed, circleId, reader } = useFlow();
  // The photos taken on the first step, still in this tab's memory (gone after a reload).
  const [pages] = useState(() => getOriginalPages());
  const [hydrated, setHydrated] = useState(false);
  const [target, setTarget] = useState<SourceTarget | null>(null);
  // Phones show one at a time: the draft, or the original.
  const [view, setView] = useState<"draft" | "original">("draft");
  const draftScroll = useRef(0);
  const [newItem, setNewItem] = useState<string | null>(null);
  const [editVisit, setEditVisit] = useState(false);
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
  const waitingIds = itemsWaiting(draft);
  const state = reviewState(draft, reviewed);
  /** The "I reviewed it" button for a section that needs one. */
  const review = (section: ReviewSection) =>
    state.sections.includes(section) ? { done: state.done[section], blocked: state.blocked[section], onToggle: (value: boolean) => setReviewed(section, value) } : undefined;
  const next = circleId ? "/new/apply" : "/new/share";

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
          const restored = (d[key] as unknown[]).slice();
          restored.splice(Math.min(index, restored.length), 0, item);
          return { ...d, [key]: restored };
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
  function addText(key: TextKey) {
    setNewItem(`${key}-${draft![key].length}`);
    set((d) => ({ ...d, [key]: [...d[key], ""] }));
  }

  /**
   * Phones: swap to the original and back, returning to the same place in the draft. With `toLine`
   * the original brings its marked line into view by itself, so the page is not moved here.
   */
  function show(which: "draft" | "original", toLine = false) {
    if (which === view) return;
    if (which === "original") draftScroll.current = window.scrollY;
    setView(which);
    if (isPhone() && !toLine) {
      const top = which === "draft" ? draftScroll.current : 0;
      requestAnimationFrame(() => window.scrollTo({ top }));
    }
  }

  /** "See it in the original": mark the item's sentence there. On a phone this also swaps to the original. */
  const seeInOriginal = (quote: string, page?: number) => {
    setTarget({ quote, page });
    if (isPhone()) show("original", true);
  };
  /** A computer follows along as the caregiver moves through the draft; a phone waits to be asked. */
  const follow = (quote: string | undefined, page?: number) => {
    if (quote && !isPhone()) setTarget((now) => (now?.quote === quote && now.page === page ? now : { quote, page }));
  };

  /** Brings the next item that needs a look into view, so the caregiver is never left hunting for it. */
  function showNextWaiting() {
    const el = document.querySelector<HTMLElement>(`[data-item="${CSS.escape(waitingIds[0])}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    el?.querySelector<HTMLElement>("button")?.focus({ preventScroll: true });
  }

  const photoCount = pages.filter((file) => !/pdf/i.test(file.type) && !/\.pdf$/i.test(file.name)).length;
  const v = draft.visit;
  const medsWaiting = draft.medications.filter(medNeedsLook);
  const settled = draft.medications.filter((m) => !medNeedsLook(m));
  const medRow = (m: MedicationChange) => {
    const i = draft.medications.indexOf(m);
    return (
      <MedRow
        key={m.id}
        med={m}
        autoEdit={newItem === m.id}
        onFocusItem={() => follow(m.sourceQuote, m.sourcePage)}
        onShowSource={seeInOriginal}
        onChange={(value) => replaceAt("medications", i, value)}
        onDelete={() => remove("medications", i)}
      />
    );
  };
  const textList = (key: TextKey, label: string) =>
    draft[key].length ? (
      <ul>
        {draft[key].map((value, i) => (
          <TextItemRow
            key={`${i}-${value}`}
            value={value}
            label={label}
            autoEdit={newItem === `${key}-${i}` && !value}
            onFocusItem={() => follow(value)}
            onSave={(x) => replaceAt(key, i, x)}
            onDelete={() => (value ? remove(key, i) : set((d) => ({ ...d, [key]: d[key].filter((_, j) => j !== i) })))}
          />
        ))}
      </ul>
    ) : (
      <EmptyNote />
    );
  const visitLine = [shortDate(v.date), v.provider, v.specialty].filter(Boolean).join(" · ");

  // The bar at the bottom: while something needs a look, "Show me" goes there; then Continue, once
  // Medicines (and Next steps and Watch for, when there are any) are marked reviewed.
  const waiting = waitingIds.length;
  const left = state.sections.length - state.doneCount;
  const NAMES: Record<string, string> = { medications: "Medicines", tasks: "Next steps", watchFor: "Watch for" };
  const bar = waiting
    ? { hint: `${waiting} ${waiting === 1 ? "item needs" : "items need"} a look first`, button: "Show me", onClick: showNextWaiting, blocked: false }
    : left
      ? {
          hint: `Review: ${state.sections.filter((section) => !state.done[section]).map((section) => NAMES[section]).join(", ")}`,
          button: "Continue",
          onClick: () => document.getElementById(`${state.sections.find((section) => !state.done[section])}-title`)?.scrollIntoView({ behavior: "smooth", block: "center" }),
          blocked: true,
        }
      : { hint: "All reviewed", button: "Continue", onClick: () => router.push(next), blocked: false };
  // Empty lists stay out of the way; a small button adds the first item.
  const emptyLists = (
    [
      ["watchFor", "Watch for"],
      ["otherNotes", "Good to know"],
      ["questions", "Question"],
    ] as const
  ).filter(([key]) => !draft[key].length);

  return (
    <div>
      <div className="mx-auto max-w-[720px] lg:mx-0 lg:max-w-none">
        <BackLink href={circleId ? `/circles/${circleId}` : "/"} label={circleId ? "Today" : "Home"} />
        <StepHeader current="Review" circle={Boolean(circleId)} />
        <h1 className="font-display text-[2.1rem] leading-tight font-medium text-primary-900">Review the draft</h1>
        <p className="mt-1 text-ink-500">Check each part against the original. Nothing is saved yet.</p>
        <ReaderNote reader={reader} />
      </div>

      {/* Phones: one at a time. The switch stays under the app bar while the page scrolls. */}
      <div className="sticky top-16 z-20 -mx-4 mt-3 border-b border-border-200 bg-surface-50 px-4 py-2 sm:top-[72px] lg:hidden">
        <div role="group" aria-label="What to show" className="mx-auto grid max-w-[720px] grid-cols-2 gap-1 rounded-xl border border-border-200 bg-white p-1">
          {(["draft", "original"] as const).map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={view === key}
              onClick={() => show(key)}
              className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg text-[15px] font-semibold ${view === key ? "bg-primary-700 text-white" : "text-ink-900"}`}
            >
              {key === "draft" ? <ListChecks size={18} aria-hidden="true" /> : photoCount ? <Images size={18} aria-hidden="true" /> : <FileText size={18} aria-hidden="true" />}
              {key === "draft" ? "Draft" : "Original"}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-6">
        <div className={`mx-auto w-full max-w-[720px] min-w-0 lg:mx-0 lg:max-w-none ${view === "original" ? "hidden lg:block" : ""}`}>
          {isSample ? (
            <div className="mb-4 flex gap-3 rounded-xl bg-sky-100 px-4 py-3 text-primary-900">
              <Info size={20} className="mt-0.5 shrink-0" aria-hidden="true" />
              <p>
                This is a sample visit for Margaret, who is fictional. Review each part to continue, or{" "}
                <Link href="/h/demo" className="font-medium text-primary-700 underline underline-offset-4">
                  see the finished handoff page
                </Link>
                .
              </p>
            </div>
          ) : null}
          {unsorted ? (
            <p role="status" className="mb-4 rounded-xl bg-med-bg px-4 py-3 text-med-ink">
              {COPY.nothingParsed}
            </p>
          ) : null}

          <datalist id={nameListId}>
            {names.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>

          <div className="space-y-3">
            <Section id="medications" tone="meds" icon={<Pill size={20} />} title="Medicines" count={draft.medications.length} review={review("medications")} onAdd={addMed} addLabel="Add a medicine">
              {!draft.medications.length ? (
                <p className="my-2 rounded-lg border border-med/40 bg-med-bg/30 px-3 py-2 text-label text-med-ink">
                  No medicines were read. If the summary names any, add them.
                </p>
              ) : null}
              {medsWaiting.length ? (
                <div className="my-2 rounded-lg border border-med/40 bg-med-bg/30 px-3 pt-2">
                  <h3 className="text-label font-bold text-med-ink">Check {medsWaiting.length === 1 ? "this" : "these"} first</h3>
                  <ul>{medsWaiting.map(medRow)}</ul>
                </div>
              ) : null}
              {settled.length ? <ul>{settled.map(medRow)}</ul> : null}
            </Section>

            <Section id="visit" tone="visit" icon={<Stethoscope size={20} />} title="The visit">
              <div className="flex items-start justify-between gap-2 py-1">
                <div className="min-w-0 flex-1">
                  <p className="text-ink-900">{visitLine || <span className="text-ink-500">No date or clinician was read.</span>}</p>
                  {v.summary && !editVisit ? <p className="mt-1 text-label text-ink-500">{v.summary}</p> : null}
                </div>
                <button
                  type="button"
                  onClick={() => setEditVisit(!editVisit)}
                  aria-expanded={editVisit}
                  aria-label={editVisit ? "Done changing the visit" : "Change the visit details"}
                  className="-mr-2 inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg px-2 font-medium text-primary-700 hover:bg-sky-100"
                >
                  {editVisit ? "Done" : <Pencil size={18} aria-hidden="true" />}
                </button>
              </div>
              {editVisit ? (
                <div className="mt-2 mb-3 grid gap-3 sm:grid-cols-2">
                  <Field id={visitIds.date} label="Visit date">
                    <input
                      id={visitIds.date}
                      type="date"
                      value={v.date ?? ""}
                      onChange={(e) => set((d) => ({ ...d, visit: { ...d.visit, date: e.target.value || undefined } }))}
                      className={`h-[2.75rem] ${inputClass}`}
                    />
                  </Field>
                  <Field id={visitIds.name} label="Who it was for (first name)">
                    <input
                      id={visitIds.name}
                      value={v.patientFirstName ?? ""}
                      maxLength={60}
                      onChange={(e) => set((d) => ({ ...d, visit: { ...d.visit, patientFirstName: e.target.value || undefined } }))}
                      className={inputClass}
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
                        rows={3}
                        value={v.summary}
                        maxLength={2000}
                        placeholder="Why the visit happened and what the clinic decided."
                        onChange={(e) => set((d) => ({ ...d, visit: { ...d.visit, summary: e.target.value } }))}
                        className={inputClass}
                      />
                    </Field>
                    {wordCount(v.summary) > 60 ? <p className="mt-1 text-sm text-ink-500">{wordCount(v.summary)} words. Try to keep it under 60.</p> : null}
                  </div>
                </div>
              ) : null}
            </Section>

            <Section id="tasks" tone="steps" icon={<CalendarCheck size={20} />} title="Next steps" count={draft.tasks.length} review={review("tasks")} onAdd={addTask} addLabel="Add a next step">
              {draft.tasks.length ? (
                <ul>
                  {draft.tasks.map((t, i) => (
                    <TaskRow
                      key={t.id}
                      task={t}
                      nameListId={nameListId}
                      plan={!circleId}
                      autoEdit={newItem === t.id}
                      onFocusItem={() => follow(t.sourceQuote, t.sourcePage)}
                      onShowSource={seeInOriginal}
                      onChange={(value) => replaceAt("tasks", i, value)}
                      onDelete={() => remove("tasks", i)}
                    />
                  ))}
                </ul>
              ) : (
                <EmptyNote />
              )}
            </Section>

            {draft.watchFor.length ? (
              <Section id="watchFor" tone="watch" icon={<Eye size={20} />} title="Watch for" review={review("watchFor")} count={draft.watchFor.length} onAdd={() => addText("watchFor")}>
                {textList("watchFor", "Watch-for item")}
              </Section>
            ) : null}
            {draft.otherNotes.length ? (
              <Section id="otherNotes" tone="know" icon={<Lightbulb size={20} />} title="Good to know" count={draft.otherNotes.length} onAdd={() => addText("otherNotes")}>
                {textList("otherNotes", "Good-to-know item")}
              </Section>
            ) : null}
            {draft.questions.length ? (
              <Section id="questions" tone="ask" icon={<HelpCircle size={20} />} title="Questions for the next visit" count={draft.questions.length} onAdd={() => addText("questions")}>
                {textList("questions", "Question")}
              </Section>
            ) : null}
            {emptyLists.length ? (
              <div className="flex flex-wrap items-center gap-x-1 gap-y-1 pt-1 text-label">
                <span className="text-ink-500">Missed something?</span>
                {emptyLists.map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => addText(key)}
                    className="inline-flex min-h-11 items-center gap-1 rounded-lg px-2 font-medium text-primary-700 hover:bg-sky-100"
                  >
                    <Plus size={16} aria-hidden="true" /> {label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <aside
          aria-labelledby="original-title"
          data-scroll-box
          // The original scrolls in its own box on a computer, so the keyboard must be able to reach it.
          tabIndex={0}
          className={`mx-auto w-full max-w-[720px] rounded-2xl border border-border-200 bg-white max-lg:overflow-clip lg:sticky lg:top-[88px] lg:mx-0 lg:max-h-[calc(100dvh-88px-92px)] lg:max-w-none lg:self-start lg:overflow-y-auto ${
            view === "draft" ? "hidden lg:block" : ""
          }`}
        >
          <OriginalView
            headingId="original-title"
            source={draft.sourceText}
            pages={pages}
            target={target}
            onClear={() => setTarget(null)}
            visible={view === "original" || !isPhone()}
            stickyClass="max-lg:top-[143px] max-sm:top-[135px]"
          />
        </aside>
      </div>

      {/* The bar: one button. On a phone looking at the original, the way back. */}
      <div data-review-bar className="no-print fixed inset-x-0 bottom-0 z-20 border-t border-border-200 bg-white pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto flex max-w-[1280px] items-center justify-between gap-3 px-4 py-3">
          <p id="confirm-hint" aria-live="polite" className={`min-w-0 text-label ${waiting ? "font-semibold text-med-ink" : "text-ink-500"} ${view === "original" ? "max-lg:hidden" : ""}`}>
            {bar.hint}
          </p>
          {view === "original" ? (
            <button
              type="button"
              onClick={() => show("draft")}
              className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-primary-700 px-5 font-semibold text-white hover:bg-primary-900 lg:hidden"
            >
              <ArrowLeft size={18} aria-hidden="true" /> Back to the draft
            </button>
          ) : null}
          <button
            type="button"
            aria-describedby="confirm-hint"
            aria-disabled={bar.blocked || undefined}
            onClick={bar.onClick}
            className={`min-h-[48px] shrink-0 rounded-xl px-5 font-semibold ${
              waiting ? "border-2 border-med bg-white text-med-ink hover:bg-med-bg" : bar.blocked ? "bg-primary-700/60 text-white" : "bg-primary-700 text-white hover:bg-primary-900"
            } ${view === "original" ? "max-lg:hidden" : ""}`}
          >
            {bar.button}
          </button>
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

function wordCount(s: string) {
  return s.trim() ? s.trim().split(/\s+/).length : 0;
}
