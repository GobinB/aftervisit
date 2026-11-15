"use client";
import { ArrowLeft, CalendarCheck, Eye, FileText, HelpCircle, Images, Info, Lightbulb, ListChecks, Pencil, Pill, Stethoscope } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { AddButton, EmptyNote, inputClass, MedRow, ReviewCard, SubSection, TaskRow, TextItemRow } from "@/components/review/parts";
import { OriginalView, type SourceTarget } from "@/components/review/SourcePanel";
import { BackLink } from "@/components/circles/PageHead";
import { StepHeader } from "@/components/StepHeader";
import { useToast } from "@/components/Toast";
import { COPY } from "@/lib/copy";
import { shortDate } from "@/lib/format";
import { itemId } from "@/lib/parse/util";
import { medNeedsLook, reviewState, waitingText } from "@/lib/review";
import type { HandoffDraft, MedicationChange, Task } from "@/lib/schema";
import { getOriginalPages, useFlow } from "@/lib/store";

type ListKey = "medications" | "tasks" | "watchFor" | "questions" | "otherNotes";
type TextKey = "watchFor" | "questions" | "otherNotes";

const isPhone = () => window.matchMedia("(max-width: 1023px)").matches;

/**
 * The draft, checked in two steps before anything is saved: the medicines, then everything else.
 * The original sits beside the draft on a computer; on a phone the two swap. The rules (what must be
 * looked at before each confirm) are in lib/review.ts.
 */
export default function ReviewPage() {
  const router = useRouter();
  const toast = useToast();
  const { draft, reviewed, isSample, unsorted, recipients, updateDraft, setReviewed, circleId } = useFlow();
  // The photos taken on the first step, still in this tab's memory (gone after a reload).
  const [pages] = useState(() => getOriginalPages());
  const [hydrated, setHydrated] = useState(false);
  const [target, setTarget] = useState<SourceTarget | null>(null);
  // Phones show one at a time: the draft, or the original.
  const [view, setView] = useState<"draft" | "original">("draft");
  const draftScroll = useRef(0);
  const [newItem, setNewItem] = useState<string | null>(null);
  const [editVisit, setEditVisit] = useState(false);
  const [medsOpen, setMedsOpen] = useState(true);
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
  const state = reviewState(draft, reviewed);
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
    setMedsOpen(true);
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

  /** Phones: swap to the original and back, returning to the same place in the draft. */
  function show(which: "draft" | "original") {
    if (which === view) return;
    if (which === "original") draftScroll.current = window.scrollY;
    setView(which);
    if (isPhone()) {
      const top = which === "draft" ? draftScroll.current : 0;
      requestAnimationFrame(() => window.scrollTo({ top }));
    }
  }

  /** "See it in the original": mark the item's sentence there. On a phone this also swaps to the original. */
  const seeInOriginal = (quote: string, page?: number) => {
    setTarget({ quote, page });
    if (isPhone()) show("original");
  };
  /** A computer follows along as the caregiver moves through the draft; a phone waits to be asked. */
  const follow = (quote: string | undefined, page?: number) => {
    if (quote && !isPhone()) setTarget((now) => (now?.quote === quote && now.page === page ? now : { quote, page }));
  };

  function confirmMeds() {
    setReviewed("medications", true);
    setMedsOpen(false);
    requestAnimationFrame(() => document.getElementById("rest-title")?.scrollIntoView({ block: "start", behavior: "smooth" }));
  }
  function confirmRest() {
    setReviewed("rest", true);
    router.push(next);
  }

  const photoCount = pages.filter((file) => !/pdf/i.test(file.type) && !/\.pdf$/i.test(file.name)).length;
  const v = draft.visit;
  const waiting = draft.medications.filter(medNeedsLook);
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

  // The bar at the bottom holds the one button for the step the caregiver is on.
  const bar =
    state.step === "medications"
      ? {
          label: "Step 1 of 2",
          hint: state.medsWaiting ? waitingText(state.medsWaiting, "medicine", "medicines") : "Check each medicine against the original.",
          blocked: state.medsWaiting > 0,
          button: "Medicines look right",
          onClick: confirmMeds,
        }
      : state.step === "rest"
        ? {
            label: "Step 2 of 2",
            hint: state.tasksWaiting ? waitingText(state.tasksWaiting, "next step", "next steps") : "Check the rest, then continue.",
            blocked: state.tasksWaiting > 0,
            button: "The rest looks right",
            onClick: confirmRest,
          }
        : { label: "Both steps checked", hint: circleId ? "Next: choose what goes into the circle." : "Next: choose who sees it.", blocked: false, button: "Continue", onClick: () => router.push(next) };

  return (
    <div>
      <div className="mx-auto max-w-[720px] lg:mx-0 lg:max-w-none">
        <BackLink href={circleId ? `/circles/${circleId}` : "/"} label={circleId ? "Today" : "Home"} />
        <StepHeader current="Review" circle={Boolean(circleId)} />
        <h1 className="font-display text-[2.1rem] leading-tight font-medium text-primary-900">Review the draft</h1>
        <p className="mt-2 text-ink-500">Two steps: check the medicines, then check the rest. Nothing is saved until you finish.</p>
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
          {!isSample ? (
            <div className="rounded-xl border border-sky-100 bg-sky-100/60 px-4 py-3 text-[15px] text-primary-900">
              <p className="font-semibold">The app read this summary, and it can make mistakes.</p>
              <p className="mt-1">
                Compare each medicine and date with the {photoCount ? "photos" : "original"}. Tap &ldquo;See it in the original&rdquo; on an item to see where it came from.
              </p>
            </div>
          ) : (
            <div className="flex gap-3 rounded-xl bg-sky-100 px-4 py-3 text-primary-900">
              <Info size={20} className="mt-0.5 shrink-0" aria-hidden="true" />
              <p>
                This is a sample visit for Margaret, who is fictional. Check both steps to continue, or{" "}
                <Link href="/h/demo" className="font-medium text-primary-700 underline underline-offset-4">
                  see the finished handoff page
                </Link>
                .
              </p>
            </div>
          )}
          {unsorted ? (
            <p role="status" className="mt-4 rounded-xl bg-med-bg px-4 py-3 text-med-ink">
              {COPY.nothingParsed}
            </p>
          ) : null}

          <datalist id={nameListId}>
            {names.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>

          <div className="mt-5 space-y-5">
            <ReviewCard id="medications" icon={<Pill size={20} />} title="Medicines" count={draft.medications.length} step="Step 1 of 2" done={state.medsDone}>
              {state.medsDone && !medsOpen ? (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="min-w-0 flex-1 text-ink-900">{draft.medications.length ? draft.medications.map((m) => m.name).join(", ") : "No medicines in this visit."}</p>
                  <button type="button" onClick={() => setMedsOpen(true)} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2 font-medium text-primary-700 hover:bg-sky-100">
                    <Pencil size={16} aria-hidden="true" /> Look again
                  </button>
                </div>
              ) : (
                <>
                  {waiting.length ? (
                    <div className="mb-3 rounded-xl border border-med/40 bg-med-bg/30 px-3 pt-2.5">
                      <h3 className="text-[15px] font-bold text-med-ink">
                        Check {waiting.length === 1 ? "this" : "these"} first ({waiting.length})
                      </h3>
                      <ul>{waiting.map(medRow)}</ul>
                    </div>
                  ) : null}
                  {settled.length ? <ul>{settled.map(medRow)}</ul> : waiting.length ? null : <EmptyNote />}
                  <AddButton label="Add a medicine" onAdd={addMed} />
                </>
              )}
            </ReviewCard>

            <ReviewCard id="rest" icon={<ListChecks size={20} />} title="Everything else" step="Step 2 of 2" done={state.restDone}>
              <div className="space-y-4">
                <SubSection id="visit" icon={<Stethoscope size={18} />} title="The visit">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="min-w-0 flex-1 text-ink-900">{visitLine || <span className="text-ink-500">No date or clinician was read.</span>}</p>
                    <button
                      type="button"
                      onClick={() => setEditVisit(!editVisit)}
                      aria-expanded={editVisit}
                      className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2 font-medium text-primary-700 hover:bg-sky-100"
                    >
                      <Pencil size={16} aria-hidden="true" /> {editVisit ? "Done" : "Change the details"}
                    </button>
                  </div>
                  {editVisit ? (
                    <div className="mt-2 grid gap-3 sm:grid-cols-2">
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
                    </div>
                  ) : null}
                  <div className="mt-3">
                    <Field id={visitIds.summary} label="Short summary">
                      <textarea
                        id={visitIds.summary}
                        rows={3}
                        value={v.summary}
                        maxLength={2000}
                        placeholder="In one or two sentences: why the visit happened and what the clinic decided."
                        onChange={(e) => set((d) => ({ ...d, visit: { ...d.visit, summary: e.target.value } }))}
                        className={inputClass}
                      />
                    </Field>
                    {wordCount(v.summary) > 60 ? <p className="mt-1 text-sm text-ink-500">{wordCount(v.summary)} words. Try to keep it under 60.</p> : null}
                  </div>
                </SubSection>

                <SubSection id="tasks" icon={<CalendarCheck size={18} />} title="Next steps" count={draft.tasks.length} onAdd={addTask} addLabel="Add a next step">
                  {draft.tasks.length ? (
                    <ul>
                      {draft.tasks.map((t, i) => (
                        <TaskRow
                          key={t.id}
                          task={t}
                          nameListId={nameListId}
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
                </SubSection>

                <SubSection id="watchFor" icon={<Eye size={18} />} title="Watch for" count={draft.watchFor.length} onAdd={() => addText("watchFor")}>
                  {textList("watchFor", "Watch-for item")}
                </SubSection>

                <SubSection
                  id="otherNotes"
                  icon={<Lightbulb size={18} />}
                  title="Good to know"
                  count={draft.otherNotes.length}
                  help="Instructions that are not a medicine or something to do once, like what to avoid."
                  onAdd={() => addText("otherNotes")}
                >
                  {textList("otherNotes", "Good-to-know item")}
                </SubSection>

                <SubSection id="questions" icon={<HelpCircle size={18} />} title="Questions for the next visit" count={draft.questions.length} onAdd={() => addText("questions")}>
                  {textList("questions", "Question")}
                </SubSection>
              </div>
            </ReviewCard>
          </div>
        </div>

        <aside
          aria-labelledby="original-title"
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
            stickyClass="top-[135px] sm:top-[143px] lg:top-0"
          />
        </aside>
      </div>

      {/* The bar: one button for the step the caregiver is on. On a phone looking at the original, the way back. */}
      <div className="no-print fixed inset-x-0 bottom-0 z-20 border-t border-border-200 bg-white">
        <div className="mx-auto flex max-w-[1280px] flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className={`text-sm text-ink-500 ${view === "original" ? "max-lg:hidden" : ""}`} aria-live="polite">
            <span className="font-semibold text-ink-900">{bar.label}</span>
            <span id="confirm-hint" className={bar.blocked ? "font-medium text-med-ink" : ""}>
              {" · "}
              {bar.hint}
              {bar.blocked ? "." : ""}
            </span>
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
            disabled={bar.blocked}
            aria-describedby="confirm-hint"
            onClick={bar.onClick}
            className={`min-h-[48px] w-full rounded-xl bg-primary-700 px-5 font-semibold text-white hover:bg-primary-900 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-primary-700 sm:w-auto ${
              view === "original" ? "max-lg:hidden" : ""
            }`}
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
