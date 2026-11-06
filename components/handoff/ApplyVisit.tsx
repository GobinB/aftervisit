"use client";

import { ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { applyVisitAction, type VisitContext } from "@/app/actions/visits";
import { BackLink } from "@/components/circles/PageHead";
import { StepHeader } from "@/components/StepHeader";
import { doseText, scheduleText, MED_SCHEDULE_LABELS } from "@/lib/schema/medications";
import type { HandoffDraft } from "@/lib/schema";
import { planMedications, type MedPlan } from "@/lib/visit-apply";
import { resolveDue } from "@/lib/parse/dates";
import { createDocumentAction } from "@/app/actions/documents";
import { Switch } from "@/components/ui/Switch";
import { keepPages } from "@/lib/page-image";
import { MAX_PAGE_BYTES } from "@/lib/schema/documents";
import { getOriginalPages } from "@/lib/store";
import { WhoChips } from "@/components/todos/TodoForm";

type Done = { added: number; changed: number; stopped: number; todos: number; events: number; failed: number };

type Appointment = { id: string; title: string; date: string; time: string; location?: string };


function MedLine({ plan }: { plan: MedPlan }) {
  switch (plan.action) {
    case "add":
      return (
        <>
          <span className="font-semibold">Add</span> {plan.name}
          {plan.dose ? ` ${plan.dose}` : ""}
          <span className="block text-[12px] text-ink-500">
            {plan.detail} · starts as “{MED_SCHEDULE_LABELS[plan.schedule]}”, check the schedule after
          </span>
        </>
      );
    case "missing":
      return (
        <>
          <span className="font-semibold">Add</span> {plan.name}
          {plan.dose ? ` ${plan.dose}` : ""}
          <span className="block text-[12px] text-ink-500">The visit says to keep taking it, and it is not on the list yet.</span>
        </>
      );
    case "update":
      return (
        <>
          <span className="font-semibold">Change</span> {plan.name}
          {plan.from !== plan.to && plan.to ? ` · ${plan.from ?? "no strength"} → ${plan.to}` : ""}
          <span className="block text-[12px] text-ink-500">{plan.detail}</span>
        </>
      );
    case "stop":
      return (
        <>
          <span className="font-semibold">Stop</span> {plan.current}
          <span className="block text-[12px] text-ink-500">It stays on the record, dated the day of the visit.</span>
        </>
      );
    case "keep":
      return (
        <>
          <span className="font-semibold">No change</span> {plan.name}
          <span className="block text-[12px] text-ink-500">Already on the list.</span>
        </>
      );
    case "absent":
      return (
        <>
          <span className="font-semibold">Nothing to stop</span> {plan.name}
          <span className="block text-[12px] text-ink-500">It is not on the list.</span>
        </>
      );
  }
}

/** Pick what goes into the circle, then save it. Shown after review for a visit started from a circle. */
export function ApplyVisit({ draft, circleId, context }: { draft: HandoffDraft; circleId: string; context: Extract<VisitContext, { ok: true }> }) {
  const [include, setInclude] = useState<Record<string, boolean>>({});
  const [assignees, setAssignees] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Done | null>(null);
  const [pending, start] = useTransition();
  // The photos (or PDF) read on the first step, still in memory. Kept only if the switch stays on.
  const [pages] = useState(() => getOriginalPages());
  const pdf = pages.length === 1 && (pages[0].type === "application/pdf" || /\.pdf$/i.test(pages[0].name));
  const canKeep = !pdf || pages[0].size <= MAX_PAGE_BYTES;
  const [keep, setKeep] = useState(true);
  const [kept, setKept] = useState<{ status: "saving"; done: number } | { status: "kept"; id: string } | { status: "failed"; error: string } | null>(null);
  const plans = useMemo(() => planMedications(draft.medications, context.medications), [draft, context]);
  // Follow-up appointments with a date (stated, or counted from the visit date) go on the calendar.
  // Everything else, and an appointment without a date, becomes a reminder.
  const { appointments, tasks } = useMemo(() => {
    const appointments: Appointment[] = [];
    const tasks: HandoffDraft["tasks"] = [];
    for (const task of draft.tasks.filter((item) => item.title.trim())) {
      const resolved = task.dueDate ? { date: task.dueDate, time: task.dueTime } : resolveDue(task.dueText ?? task.sourceQuote ?? "", draft.visit.date);
      if (task.category === "appointment" && resolved?.date) {
        appointments.push({ id: task.id, title: task.title.trim().slice(0, 200), date: resolved.date, time: task.dueTime ?? resolved.time ?? "" });
      } else {
        tasks.push(task);
      }
    }
    return { appointments, tasks };
  }, [draft]);
  const [dates, setDates] = useState<Record<string, { date: string; time: string }>>({});
  const [going, setGoing] = useState<Record<string, string>>({});
  const when = (appt: Appointment) => dates[appt.id] ?? { date: appt.date, time: appt.time };
  const actionable = (plan: MedPlan) => plan.action === "add" || plan.action === "update" || plan.action === "stop" || plan.action === "missing";
  const on = (key: string, fallback: boolean) => include[key] ?? fallback;

  const apply = () => {
    setError(null);
    const meds = plans
      .filter((plan) => actionable(plan) && on(plan.draftId, plan.action !== "missing"))
      .map((plan) => {
        if (plan.action === "add" || plan.action === "missing") {
          return { action: "add" as const, name: plan.name, detail: plan.detail, reason: plan.reason, dose: plan.dose, schedule: plan.schedule };
        }
        if (plan.action === "update") return { action: "update" as const, medId: plan.medId, detail: plan.detail, dose: plan.to };
        return { action: "stop" as const, medId: (plan as Extract<MedPlan, { action: "stop" }>).medId };
      });
    const todos = tasks
      .filter((task) => on(task.id, true))
      .map((task) => ({
        title: task.title.trim().slice(0, 200),
        ...(task.dueDate ? { dueDate: task.dueDate } : {}),
        ...(task.dueText ? { note: `Due ${task.dueText}` } : {}),
        assignee: assignees[task.id] ?? "none",
      }));
    const events = appointments
      .filter((appt) => on(appt.id, true) && when(appt).date)
      .map((appt) => ({
        title: appt.title,
        date: when(appt).date,
        ...(when(appt).time ? { startTime: when(appt).time } : {}),
        going: going[appt.id] ?? "none",
      }));
    start(async () => {
      const result = await applyVisitAction({
        circleId,
        ...(draft.visit.date ? { visitDate: draft.visit.date } : {}),
        ...(draft.visit.clinic ? { clinic: draft.visit.clinic } : {}),
        meds,
        todos,
        events,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setDone(result);
      if (keep && pages.length && canKeep) await keepTheSummary();
    });
  };

  /** Saves the photos (or PDF) after the circle is updated, page by page with a count on screen. */
  async function keepTheSummary() {
    setKept({ status: "saving", done: 0 });
    const created = await createDocumentAction({
      circleId,
      ...(draft.visit.date ? { visitDate: draft.visit.date } : {}),
      ...(draft.visit.clinic ? { clinic: draft.visit.clinic.slice(0, 300) } : {}),
      kind: pdf ? "pdf" : "photos",
      pageCount: pages.length,
    }).catch(() => ({ ok: false as const, error: "The photos could not be kept." }));
    if (!created.ok) {
      setKept({ status: "failed", error: created.error });
      return;
    }
    const sent = await keepPages(circleId, created.id, pages, pdf ? "pdf" : "photos", (n) => setKept({ status: "saving", done: n }));
    setKept(sent.ok ? { status: "kept", id: created.id } : { status: "failed", error: sent.error });
  }

  if (done) {
    const parts = [
      done.added ? `${done.added} medication${done.added === 1 ? "" : "s"} added` : null,
      done.changed ? `${done.changed} medication${done.changed === 1 ? "" : "s"} changed` : null,
      done.stopped ? `${done.stopped} medication${done.stopped === 1 ? "" : "s"} stopped` : null,
      done.todos ? `${done.todos} reminder${done.todos === 1 ? "" : "s"} added` : null,
      done.events ? `${done.events} appointment${done.events === 1 ? "" : "s"} on the calendar` : null,
    ].filter(Boolean);
    return (
      <div className="mx-auto max-w-[720px]">
        <StepHeader current="Done" circle />
        <div className="rounded-lg border border-border-200 bg-white p-6">
          <CheckCircle2 className="size-8 text-ok" aria-hidden="true" />
          <h1 className="font-display mt-3 text-[26px] text-primary-900">{context.personName}&apos;s circle is up to date</h1>
          <p className="mt-2 text-ink-500">{parts.length ? `${parts.join(", ")}.` : "Nothing was changed."} Everyone you allow sees it on their link.</p>
          {kept ? (
            <p role="status" className={`mt-3 rounded-md px-3 py-2 text-[14px] ${kept.status === "failed" ? "bg-attn-bg text-attn-ink" : "bg-sky-100 text-primary-900"}`}>
              {kept.status === "saving" ? (
                <>
                  <Loader2 className="mr-1.5 inline size-4 animate-spin align-[-3px]" aria-hidden="true" />
                  Keeping the {pdf ? "PDF" : "photos"}… {pdf ? "" : `${kept.done} of ${pages.length}`}
                </>
              ) : kept.status === "kept" ? (
                <>
                  The {pdf ? "PDF is" : `${pages.length === 1 ? "photo is" : "photos are"}`} kept with this visit.{" "}
                  <Link href={`/circles/${circleId}/visits/${kept.id}`} className="font-semibold underline underline-offset-2">
                    See {pdf ? "it" : "them"}
                  </Link>
                </>
              ) : (
                <>The circle is updated, but the {pdf ? "PDF" : "photos"} could not be kept: {kept.error}</>
              )}
            </p>
          ) : null}
          {done.failed ? (
            <p role="alert" className="mt-3 rounded-md bg-attn-bg px-3 py-2 text-[13px] text-attn-ink">
              {done.failed} change{done.failed === 1 ? "" : "s"} could not be saved. Check the Medications and Reminders pages.
            </p>
          ) : null}
          <div className="mt-5 flex flex-wrap gap-2">
            <Link href={`/circles/${circleId}`} className="inline-flex h-10 items-center gap-1.5 rounded-md bg-primary-700 px-4 text-[14px] font-semibold text-white hover:bg-primary-900">
              Go to Today <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
            <Link href={`/circles/${circleId}/medications`} className="inline-flex h-10 items-center rounded-md border border-border-200 bg-white px-4 text-[14px] font-medium text-ink-900 hover:bg-paper-100">
              See medications
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const current = context.medications.filter((med) => med.status === "active");
  return (
    <div className="mx-auto max-w-[820px] pb-8">
      <BackLink href="/new/review" label="Review" />
      <StepHeader current="Share" circle />
      <h1 className="font-display text-[28px] leading-tight text-primary-900">Update {context.personName}&apos;s circle</h1>
      <p className="mt-1 text-[14px] text-ink-500">Untick anything you don&apos;t want. Nothing is saved until you press the button.</p>

      <section aria-labelledby="meds-title" className="mt-6">
        <h2 id="meds-title" className="mb-2 text-[11px] font-semibold tracking-[0.12em] text-ink-500 uppercase">
          Medications
        </h2>
        <div className="rounded-lg border border-border-200 bg-white">
          {plans.length ? (
            <ul className="divide-y divide-border-200">
              {plans.map((plan) => {
                const can = actionable(plan);
                const checked = can && on(plan.draftId, plan.action !== "missing");
                return (
                  <li key={plan.draftId} className="flex items-start gap-3 px-4 py-3 text-[14px] text-ink-900">
                    <input
                      type="checkbox"
                      className="mt-1 size-4 accent-primary-700"
                      checked={checked}
                      disabled={!can}
                      onChange={(event) => setInclude({ ...include, [plan.draftId]: event.target.checked })}
                      aria-label={`Include ${plan.name}`}
                    />
                    <span className={can ? "" : "text-ink-500"}>
                      <MedLine plan={plan} />
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="px-4 py-3 text-[13px] text-ink-500">The visit has no medication changes.</p>
          )}
        </div>
        {current.length ? (
          <details className="mt-2 text-[13px] text-ink-500">
            <summary className="cursor-pointer">What is on the list now ({current.length})</summary>
            <ul className="mt-1 space-y-0.5 pl-4">
              {current.map((med) => (
                <li key={med.id}>
                  {med.name} {doseText(med)} · {scheduleText(med)}
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </section>

      {appointments.length ? (
        <section aria-labelledby="appts-title" className="mt-6">
          <h2 id="appts-title" className="mb-2 text-[11px] font-semibold tracking-[0.12em] text-ink-500 uppercase">
            Appointments for the calendar
          </h2>
          <div className="rounded-lg border border-border-200 bg-white">
            <ul className="divide-y divide-border-200">
              {appointments.map((appt) => (
                <li key={appt.id} className="space-y-3 px-4 py-3 text-[14px] text-ink-900">
                  <label className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      className="mt-1 size-5 accent-primary-700"
                      checked={on(appt.id, true)}
                      onChange={(event) => setInclude({ ...include, [appt.id]: event.target.checked })}
                    />
                    <span className="text-[15px] font-semibold">{appt.title}</span>
                  </label>
                  {on(appt.id, true) ? (
                    <div className="space-y-3 pl-8">
                      <div className="flex flex-wrap gap-2">
                        <label className="text-[13px] font-medium text-ink-500">
                          Day
                          <input
                            type="date"
                            className="mt-1 block h-11 rounded-lg border border-border-200 bg-white px-2 text-[16px] text-ink-900"
                            value={when(appt).date}
                            onChange={(event) => setDates({ ...dates, [appt.id]: { ...when(appt), date: event.target.value } })}
                          />
                        </label>
                        <label className="text-[13px] font-medium text-ink-500">
                          Time
                          <input
                            type="time"
                            className="mt-1 block h-11 rounded-lg border border-border-200 bg-white px-2 text-[16px] text-ink-900"
                            value={when(appt).time}
                            onChange={(event) => setDates({ ...dates, [appt.id]: { ...when(appt), time: event.target.value } })}
                          />
                        </label>
                      </div>
                      <div>
                        <p className="text-[13px] font-medium text-ink-500">Who&apos;s going?</p>
                        <WhoChips
                          value={going[appt.id] ?? "none"}
                          onPick={(value) => setGoing({ ...going, [appt.id]: value })}
                          people={context.people}
                          options={[
                            { value: "none", label: "Decide later" },
                            { value: "volunteer", label: "Needs someone" },
                            { value: "caregiver", label: "Me" },
                          ]}
                        />
                      </div>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      <section aria-labelledby="todos-title" className="mt-6">
        <h2 id="todos-title" className="mb-2 text-[11px] font-semibold tracking-[0.12em] text-ink-500 uppercase">
          Reminders
        </h2>
        <div className="rounded-lg border border-border-200 bg-white">
          {tasks.length ? (
            <ul className="divide-y divide-border-200">
              {tasks.map((task) => (
                <li key={task.id} className="flex flex-wrap items-start gap-3 px-4 py-3 text-[14px] text-ink-900">
                  <input
                    type="checkbox"
                    className="mt-1 size-4 accent-primary-700"
                    checked={on(task.id, true)}
                    onChange={(event) => setInclude({ ...include, [task.id]: event.target.checked })}
                    aria-label={`Include ${task.title}`}
                  />
                  <span className="min-w-0 flex-1">
                    {task.title}
                    {task.dueDate || task.dueText ? <span className="block text-[12px] text-ink-500">Due {task.dueDate ?? task.dueText}</span> : null}
                  </span>
                  <div className="w-full pl-7">
                    <WhoChips value={assignees[task.id] ?? "none"} onPick={(value) => setAssignees({ ...assignees, [task.id]: value })} people={context.people} />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-3 text-[13px] text-ink-500">No other next steps in this visit.</p>
          )}
        </div>
      </section>

      {pages.length ? (
        <section className="mt-6 rounded-lg border border-border-200 bg-white p-4">
          <Switch
            id="keep-original"
            checked={keep && canKeep}
            onChange={setKeep}
            label={pdf ? "Keep the PDF with this visit" : `Keep the ${pages.length === 1 ? "photo" : `${pages.length} photos`} with this visit`}
            helper={
              canKeep
                ? "So you can look at the original later. Only you can see it, and you can delete it any time."
                : "This PDF is too large to keep. The circle is still updated."
            }
          />
        </section>
      ) : null}

      {error ? (
        <p role="alert" className="mt-4 rounded-md bg-attn-bg px-3 py-2 text-[13px] text-attn-ink">
          {error}
        </p>
      ) : null}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={apply}
          disabled={pending}
          className="inline-flex h-11 items-center gap-2 rounded-md bg-primary-700 px-5 text-[15px] font-semibold text-white hover:bg-primary-900 disabled:opacity-50"
        >
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
          {pending ? "Updating" : "Update the circle"}
        </button>
        <Link href="/new/review" className="inline-flex h-11 items-center rounded-md px-3 text-[14px] font-medium text-ink-500 hover:text-ink-900">
          Back to the review
        </Link>
      </div>
    </div>
  );
}
