"use client";

import { ArrowRight, CheckCircle2, Eye, HelpCircle, Lightbulb, Loader2 } from "lucide-react";
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
import { visitLines } from "@/lib/schema/visits";
import { getOriginalPages } from "@/lib/store";
import { ShareUpdates } from "@/components/circles/ShareUpdates";
import { AddSomeone, HelperChips, isNewHelper, type Helper } from "@/components/handoff/WhoHelps";
import { TellHelpers, type TellPerson } from "@/components/handoff/TellHelpers";
import { addMemberAction } from "@/app/actions/members";
import { HELPER_ROLE_LABELS, type HelperRole } from "@/lib/schema/circles";
import { ensureCircleKey } from "@/components/circles/circle-key";
import { generateFileKey, sealPage, wrapFileKey } from "@/lib/crypto";

type Done = { added: number; changed: number; stopped: number; todos: number; events: number; failed: number; visitId: string | null; notes: number };

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
  // Kept with the visit and shown on Today: nothing here is thrown away.
  const notes = useMemo(
    () => ({
      provider: draft.visit.provider,
      specialty: draft.visit.specialty,
      reason: draft.visit.reason,
      summary: draft.visit.summary.trim(),
      watchFor: visitLines(draft.watchFor),
      goodToKnow: visitLines(draft.otherNotes),
      questions: visitLines(draft.questions),
    }),
    [draft],
  );
  const noteLists = [
    { key: "watch", title: "Watch for", icon: Eye, lines: notes.watchFor },
    { key: "know", title: "Good to know", icon: Lightbulb, lines: notes.goodToKnow },
    { key: "ask", title: "Questions for the next visit", icon: HelpCircle, lines: notes.questions },
  ].filter((list) => list.lines.length);
  const [dates, setDates] = useState<Record<string, { date: string; time: string }>>({});
  const [going, setGoing] = useState<Record<string, string>>({});
  // People added on this page. They join the circle when it is updated, not before.
  const [added, setAdded] = useState<Helper[]>([]);
  const [addingFor, setAddingFor] = useState<string | null>(null);
  // Those already saved, so pressing the button again after a problem never adds anyone twice.
  const [created, setCreated] = useState<Record<string, { memberId: string; token: string }>>({});
  const [tell, setTell] = useState<TellPerson[]>([]);
  const people: Helper[] = useMemo(() => [...context.people, ...added], [context.people, added]);
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
    const todoTasks = tasks.filter((task) => on(task.id, true));
    const eventAppts = appointments.filter((appt) => on(appt.id, true) && when(appt).date);
    start(async () => {
      // Someone added on this page joins the circle first, so the appointments and reminders can be theirs.
      const made = { ...created };
      for (const person of added) {
        if (made[person.value]) continue;
        const result = await addMemberAction({ circleId, name: person.name, role: person.role ?? "family", ...(person.phone ? { phone: person.phone } : {}) }).catch(() => ({
          ok: false as const,
          error: "Check your connection and try again.",
        }));
        if (!result.ok) {
          setCreated(made);
          setError(`${person.name} could not be added. ${result.error} Nothing from the visit is saved yet.`);
          return;
        }
        made[person.value] = { memberId: result.memberId, token: result.token };
      }
      setCreated(made);
      const who = (value: string | undefined) => (value && isNewHelper(value) ? (made[value]?.memberId ?? "none") : (value ?? "none"));
      const todos = todoTasks.map((task) => ({
        title: task.title.trim().slice(0, 200),
        ...(task.dueDate ? { dueDate: task.dueDate } : {}),
        ...(task.dueText ? { note: `Due ${task.dueText}` } : {}),
        assignee: who(assignees[task.id]),
      }));
      const events = eventAppts.map((appt) => ({
        title: appt.title,
        date: when(appt).date,
        ...(when(appt).time ? { startTime: when(appt).time } : {}),
        going: who(going[appt.id]),
      }));
      const result = await applyVisitAction({
        circleId,
        ...(draft.visit.date ? { visitDate: draft.visit.date } : {}),
        ...(draft.visit.clinic ? { clinic: draft.visit.clinic } : {}),
        meds,
        todos,
        events,
        notes,
      }).catch(() => ({ ok: false as const, error: "The circle could not be updated. Check your connection and try again." }));
      if (!result.ok) {
        setError(added.length ? `${result.error} The people you added are in the circle already; pressing the button again will not add them twice.` : result.error);
        return;
      }
      // Everyone put down for something, and everyone added here, gets a row to text them their part.
      setTell(
        people
          .map((person): TellPerson | null => {
            const memberId = isNewHelper(person.value) ? made[person.value]?.memberId : person.value;
            if (!memberId) return null;
            const assigned = {
              appointments: eventAppts.filter((appt) => going[appt.id] === person.value).map((appt) => ({ date: when(appt).date, time: when(appt).time || null })),
              reminders: todoTasks.filter((task) => assignees[task.id] === person.value).length,
            };
            const isNew = isNewHelper(person.value);
            if (!isNew && !assigned.appointments.length && !assigned.reminders) return null;
            return { memberId, name: person.name, phone: person.phone, isNew, ...(isNew ? { token: made[person.value].token } : {}), assigned };
          })
          .filter((person): person is TellPerson => person !== null),
      );
      setDone(result);
      if (keep && pages.length && canKeep) await keepTheSummary(result.visitId);
    });
  };

  /** Adds someone typed in on this page, picked for the item the form was opened from. */
  function addPerson(itemId: string, kind: "appointment" | "reminder", person: { name: string; role: HelperRole; phone: string | null }) {
    const value = `new:${added.length + 1}`;
    setAdded([...added, { value, label: `${person.name} (${HELPER_ROLE_LABELS[person.role]})`, name: person.name, phone: person.phone, role: person.role, isNew: true }]);
    if (kind === "appointment") setGoing({ ...going, [itemId]: value });
    else setAssignees({ ...assignees, [itemId]: value });
    setAddingFor(null);
  }

  /**
   * Saves the photos (or PDF) after the circle is updated, page by page with a count on screen.
   * Each summary gets its own file key, made here and wrapped by the circle key; the pages are
   * encrypted with it on this device, so only encrypted pages are ever sent or stored.
   */
  async function keepTheSummary(visitId: string | null) {
    setKept({ status: "saving", done: 0 });
    let fileKey: CryptoKey;
    let stored: Awaited<ReturnType<typeof wrapFileKey>>;
    try {
      // The circle's key for files, handed over by the server with nothing to type (made now if the circle has none).
      const found = await ensureCircleKey(circleId, context.key);
      if (!found.ok) {
        setKept({ status: "failed", error: found.error });
        return;
      }
      fileKey = await generateFileKey();
      stored = await wrapFileKey(fileKey, found.key, found.keyVersion);
    } catch {
      setKept({ status: "failed", error: "This browser could not lock them." });
      return;
    }
    const created = await createDocumentAction({
      ...stored,
      circleId,
      ...(draft.visit.date ? { visitDate: draft.visit.date } : {}),
      ...(draft.visit.clinic ? { clinic: draft.visit.clinic.slice(0, 300) } : {}),
      kind: pdf ? "pdf" : "photos",
      pageCount: pages.length,
      ...(visitId ? { visitId } : {}),
    }).catch(() => ({ ok: false as const, error: "The photos could not be kept." }));
    if (!created.ok) {
      setKept({ status: "failed", error: created.error });
      return;
    }
    const sent = await keepPages(circleId, created.id, pages, pdf ? "pdf" : "photos", (plain, page) => sealPage(plain, fileKey, created.id, page), (n) => setKept({ status: "saving", done: n }));
    setKept(sent.ok ? { status: "kept", id: created.id } : { status: "failed", error: sent.error });
  }

  if (done) {
    const parts = [
      done.added ? `${done.added} medication${done.added === 1 ? "" : "s"} added` : null,
      done.changed ? `${done.changed} medication${done.changed === 1 ? "" : "s"} changed` : null,
      done.stopped ? `${done.stopped} medication${done.stopped === 1 ? "" : "s"} stopped` : null,
      done.todos ? `${done.todos} reminder${done.todos === 1 ? "" : "s"} added` : null,
      done.events ? `${done.events} appointment${done.events === 1 ? "" : "s"} on the calendar` : null,
      done.visitId && (done.notes || notes.summary) ? "the visit notes kept" : null,
    ].filter(Boolean);
    return (
      <div className="mx-auto max-w-[720px]">
        <StepHeader current="Done" circle />
        <div className="rounded-lg border border-border-200 bg-white p-6">
          <CheckCircle2 className="size-8 text-ok" aria-hidden="true" />
          <h1 className="font-display mt-3 text-[26px] text-primary-900">{context.personName}&apos;s circle is up to date</h1>
          <p className="mt-2 text-ink-500">{parts.length ? `${parts.join(", ")}.` : "Nothing was changed."}</p>
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
          {tell.length ? (
            <div className="mt-5 border-t border-border-200 pt-5">
              <TellHelpers circleId={circleId} personName={context.personName} people={tell} />
            </div>
          ) : null}
          <div className="mt-5 border-t border-border-200 pt-5">
            <ShareUpdates circleId={circleId} personName={context.personName} skip={tell.map((person) => person.memberId)} />
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link href={`/circles/${circleId}`} className="inline-flex h-10 items-center gap-1.5 rounded-md bg-primary-700 px-4 text-[14px] font-semibold text-white hover:bg-primary-900">
              Go to Today <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
            <Link href={`/circles/${circleId}/medications`} className="inline-flex h-10 items-center rounded-md border border-border-200 bg-white px-4 text-[14px] font-medium text-ink-900 hover:bg-paper-100">
              See medications
            </Link>
            {done.visitId ? (
              <Link href={`/circles/${circleId}/visits/notes/${done.visitId}`} className="inline-flex h-10 items-center rounded-md border border-border-200 bg-white px-4 text-[14px] font-medium text-ink-900 hover:bg-paper-100">
                See the visit notes
              </Link>
            ) : null}
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
      <p className="mt-1 text-[14px] text-ink-500">
        Untick anything you don&apos;t want, and pick who helps with each appointment and reminder (or leave it for later). Nothing is saved until you press the button; then you can text each
        person their part.
      </p>

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
                        <p className="text-[13px] font-medium text-ink-500">Who&apos;s going with {context.personName}?</p>
                        <HelperChips
                          label={`Who's going to ${appt.title}`}
                          value={going[appt.id] ?? "none"}
                          onPick={(value) => setGoing({ ...going, [appt.id]: value })}
                          people={people}
                          adding={addingFor === appt.id}
                          onAdd={() => setAddingFor(addingFor === appt.id ? null : appt.id)}
                        />
                        {addingFor === appt.id ? <AddSomeone onAdd={(person) => addPerson(appt.id, "appointment", person)} onCancel={() => setAddingFor(null)} /> : null}
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
                  {on(task.id, true) ? (
                    <div className="w-full pl-7">
                      <p className="text-[13px] font-medium text-ink-500">Who does it?</p>
                      <HelperChips
                        label={`Who does ${task.title}`}
                        value={assignees[task.id] ?? "none"}
                        onPick={(value) => setAssignees({ ...assignees, [task.id]: value })}
                        people={people}
                        adding={addingFor === task.id}
                        onAdd={() => setAddingFor(addingFor === task.id ? null : task.id)}
                      />
                      {addingFor === task.id ? <AddSomeone onAdd={(person) => addPerson(task.id, "reminder", person)} onCancel={() => setAddingFor(null)} /> : null}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-3 text-[13px] text-ink-500">No other next steps in this visit.</p>
          )}
        </div>
      </section>

      <section aria-labelledby="notes-title" className="mt-6">
        <h2 id="notes-title" className="mb-2 text-[11px] font-semibold tracking-[0.12em] text-ink-500 uppercase">
          Kept with this visit
        </h2>
        <div className="rounded-lg border border-border-200 bg-white px-4 py-3 text-[14px] text-ink-900">
          {notes.summary || noteLists.length ? (
            <>
              {notes.summary ? <p>{notes.summary}</p> : null}
              {noteLists.map((list) => (
                <div key={list.key} className="mt-3 first:mt-0">
                  <p className="flex items-center gap-1.5 text-[13px] font-semibold text-primary-900">
                    <list.icon className="size-4 text-primary-700" aria-hidden="true" /> {list.title}
                  </p>
                  <ul className="mt-1 list-disc space-y-0.5 pl-6">
                    {list.lines.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </div>
              ))}
              <p className="mt-3 border-t border-border-200 pt-2.5 text-[12px] text-ink-500">
                Shown on Today. Family and care managers see all of it; home aides and day programs see what to watch for and good to know.
              </p>
            </>
          ) : (
            <p className="text-[13px] text-ink-500">This visit has no notes to keep beyond the changes above.</p>
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
                ? `Locked on this device before ${pdf ? "it is" : "they are"} saved. In the app, only you can see ${pdf ? "it" : "them"}, and you can delete ${pdf ? "it" : "them"} any time.`
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
