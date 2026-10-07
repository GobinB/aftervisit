"use client";
import { CalendarCheck, Check, ChevronDown, Eye, FileText, HelpCircle, NotebookPen, Pill, Printer, Quote, Type } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { MedBadge } from "@/components/Badge";
import { LogoMark } from "@/components/Logo";
import { COPY, visitTitle } from "@/lib/copy";
import { longDate, shortDate } from "@/lib/format";
import { ROLE_LABELS, type HandoffView, type Task, type TaskStatusValue, type TaskStatusView } from "@/lib/schema";
import { Attribution, StatusChip, TaskStatusControl } from "./TaskStatus";

const LARGE_KEY = "aftervisit-large-text";

function groupTasks(tasks: Task[], order: string[]): { who: string; tasks: Task[] }[] {
  const groups = new Map<string, Task[]>();
  for (const t of tasks) {
    const who = t.assignee?.trim() || "";
    groups.set(who, [...(groups.get(who) ?? []), t]);
  }
  const rank = (w: string) => {
    if (!w) return Number.MAX_SAFE_INTEGER;
    const i = order.findIndex((n) => n.toLowerCase() === w.toLowerCase());
    return i === -1 ? order.length : i;
  };
  return [...groups.entries()].sort((a, b) => rank(a[0]) - rank(b[0])).map(([who, tasks]) => ({ who, tasks }));
}

function SectionHeading({ icon, children, id }: { icon: React.ReactNode; children: React.ReactNode; id: string }) {
  return (
    <h2 id={id} className="flex items-center gap-2 text-xl font-semibold text-primary-700">
      <span aria-hidden="true">{icon}</span>
      {children}
    </h2>
  );
}

/**
 * The read-only handoff a recipient sees. Mobile-first, printable, no navigation chrome.
 * `onAck` posts the acknowledgment; the demo passes a local stub.
 */
export function HandoffDocument({
  view,
  originalUrl,
  onAck,
  onTaskUpdate,
  taskStatus,
  creatorView,
  autoPrint,
}: {
  view: HandoffView;
  originalUrl?: string | null;
  /** Shared link: the typed name. Personal link: ignored (recorded against the invitation). */
  onAck?: (name: string) => Promise<{ ok: true } | { ok: false; message: string }>;
  onTaskUpdate?: (taskId: string, status: TaskStatusValue, note?: string) => Promise<{ ok: true; taskStatus: TaskStatusView } | { ok: false; message: string }>;
  /** Statuses for a read-only view (the caregiver's full view). */
  taskStatus?: Record<string, TaskStatusView>;
  /** The caregiver's own full view: no acknowledgment. */
  creatorView?: boolean;
  autoPrint?: boolean;
}) {
  const p = view.payload;
  const creator = view.createdByFirstName;
  const invite = view.invite;
  const [statuses, setStatuses] = useState<Record<string, TaskStatusView>>(invite?.taskStatus ?? taskStatus ?? {});
  const canUpdate = new Set(invite?.canUpdate ?? []);
  const [large, setLarge] = useState(false);
  const [showWords, setShowWords] = useState(false);
  const [ackName, setAckName] = useState("");
  const [acked, setAcked] = useState<string | null>(null);
  const [ackBusy, setAckBusy] = useState(false);
  const [ackError, setAckError] = useState<string | null>(null);
  const nameId = useId();
  const ackKey = `aftervisit-ack-${view.token}`;

  useEffect(() => {
    try {
      setLarge(localStorage.getItem(LARGE_KEY) === "1");
      if (invite) setAcked(invite.ackedAt ? invite.recipientName : null);
      else setAcked(localStorage.getItem(ackKey));
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ackKey]);

  useEffect(() => {
    document.documentElement.classList.toggle("av-large", large);
    return () => document.documentElement.classList.remove("av-large");
  }, [large]);

  useEffect(() => {
    if (!autoPrint) return;
    const t = setTimeout(() => window.print(), 400);
    return () => clearTimeout(t);
  }, [autoPrint]);

  const toggleLarge = () => {
    const next = !large;
    setLarge(next);
    try {
      localStorage.setItem(LARGE_KEY, next ? "1" : "0");
    } catch {}
  };

  async function submitAck(e: React.FormEvent) {
    e.preventDefault();
    if (!onAck) return;
    const name = invite ? invite.recipientName : ackName.trim();
    if (!name) return setAckError("Please add your name so they know who read it.");
    setAckBusy(true);
    setAckError(null);
    const r = await onAck(name);
    setAckBusy(false);
    if (!r.ok) return setAckError(r.message);
    setAcked(name);
    if (invite) return;
    try {
      localStorage.setItem(ackKey, name);
    } catch {}
  }

  async function updateTask(taskId: string, status: TaskStatusValue, note?: string) {
    if (!onTaskUpdate) return { ok: false as const, message: COPY.genericError };
    const r = await onTaskUpdate(taskId, status, note);
    if (r.ok) setStatuses((s) => ({ ...s, [taskId]: r.taskStatus }));
    return r.ok ? { ok: true as const } : r;
  }

  const providerLine = [p.visit.provider, p.visit.specialty].filter(Boolean).join(", ");
  const prepared = [
    creator ? `Prepared by ${creator} on ${shortDate(view.createdAt)}.` : `Prepared on ${shortDate(view.createdAt)}.`,
    `Expires ${shortDate(view.expiresAt)}.`,
  ].join(" ");
  const recipientOrder = view.recipients.map((r) => r.name);
  const hasQuotes = [...p.medications, ...p.tasks].some((i) => i.sourceQuote);
  const roleOf = (name: string) => {
    if (invite && name.toLowerCase() === invite.recipientName.toLowerCase()) return ROLE_LABELS[invite.recipientRole];
    const r = view.recipients.find((x) => x.name.toLowerCase() === name.toLowerCase());
    return r ? ROLE_LABELS[r.role] : null;
  };
  const isMe = (name: string) => !!invite && name.toLowerCase() === invite.recipientName.toLowerCase();
  const groups = groupTasks(p.tasks, recipientOrder);

  return (
    <div className="min-h-dvh bg-surface-50 print:bg-white">
      <header className="bg-primary-900 text-white print:bg-white print:text-black">
        <div className="mx-auto flex h-14 max-w-[640px] items-center gap-2.5 px-4">
          <LogoMark size={32} variant="onDark" />
          <span className="shrink-0 text-lg font-semibold whitespace-nowrap">Care update</span>
          {p.visit.clinic ? (
            <span className="ml-auto min-w-0 truncate pl-3 text-right text-sm text-white/75 print:text-black">{p.visit.clinic}</span>
          ) : null}
        </div>
      </header>

      <main id="main" className="mx-auto max-w-[640px] px-4 pt-6 pb-10">
        <h1 className="font-display text-[2.1rem] leading-tight font-medium text-primary-900">{visitTitle(p)}</h1>
        {providerLine ? <p className="mt-1 text-lg">{providerLine}</p> : null}
        <p className="mt-1 text-ink-500">{prepared}</p>
        {invite ? (
          <p className="mt-3 rounded-xl bg-sky-100 px-4 py-2.5 text-primary-900">
            Shared with you, <strong>{invite.recipientName}</strong> ({ROLE_LABELS[invite.recipientRole]}). This is your personal link; please
            don&apos;t forward it.
          </p>
        ) : view.recipients.length ? (
          <p className="mt-1 text-sm text-ink-500">
            Shared with {view.recipients.map((r) => `${r.name} (${ROLE_LABELS[r.role]})`).join(", ")}
          </p>
        ) : null}
        {hasQuotes ? (
          <button
            type="button"
            aria-pressed={showWords}
            onClick={() => setShowWords((v) => !v)}
            className={`no-print mt-4 inline-flex min-h-10 items-center gap-2 rounded-full border px-3.5 text-sm font-medium ${
              showWords ? "border-action-500 bg-sky-100 text-primary-900" : "border-border-200 bg-white text-primary-700"
            }`}
          >
            <Quote size={16} aria-hidden="true" /> Show the clinic&apos;s exact words
          </button>
        ) : null}

        <div className="mt-6 space-y-5">
          {p.medications.length ? (
            <section aria-labelledby="h-meds" className="print-plain rounded-2xl border border-border-200 bg-white p-5">
              <SectionHeading id="h-meds" icon={<Pill size={20} />}>
                What changed
              </SectionHeading>
              <ul className="mt-3 divide-y divide-border-200/70">
                {p.medications.map((m) => (
                  <li key={m.id} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-lg font-medium">{m.name}</span>
                      <MedBadge kind={m.kind} />
                    </div>
                    <p className="mt-0.5">{m.detail}</p>
                    {m.reason ? <p className="text-sm text-ink-500">For: {m.reason}</p> : null}
                    <Provenance quote={m.sourceQuote} added={m.origin === "caregiver"} show={showWords} creator={creator} />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {p.tasks.length ? (
            <section aria-labelledby="h-tasks" className="print-plain rounded-2xl border border-border-200 bg-white p-5">
              <SectionHeading id="h-tasks" icon={<CalendarCheck size={20} />}>
                What needs to happen next
              </SectionHeading>
              <p className="mt-1 text-sm text-ink-500">
                The steps come from the clinic&apos;s summary. {creator ?? "The person who shared this"} chose who handles each one.
              </p>
              <div className="mt-3 space-y-4">
                {groups.map((g) => (
                  <div key={g.who || "anyone"}>
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-ink-500">
                      {g.who ? (isMe(g.who) ? `For you (${g.who})` : `For ${g.who}`) : "Not assigned yet"}
                      {g.who && roleOf(g.who) ? <span className="font-normal normal-case tracking-normal"> · {roleOf(g.who)}</span> : null}
                    </h3>
                    <ul className="mt-1.5 space-y-2">
                      {g.tasks.map((t) => {
                        const when = t.dueDate ? `By ${longDate(t.dueDate)}` : t.dueText ? capitalize(t.dueText) : "";
                        return (
                          <li key={t.id} className="flex gap-3">
                            <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary-700" aria-hidden="true" />
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                                <p>{t.title}</p>
                                {statuses[t.id] ? <StatusChip status={statuses[t.id].status} /> : null}
                              </div>
                              {when ? <p className="text-sm text-ink-500">{when}</p> : null}
                              <Provenance quote={t.sourceQuote} added={t.origin === "caregiver"} show={showWords} creator={creator} />
                              <Attribution s={statuses[t.id]} />
                              {statuses[t.id] && canUpdate.has(t.id) && onTaskUpdate ? (
                                <TaskStatusControl taskTitle={t.title} value={statuses[t.id]} onSave={(s, n) => updateTask(t.id, s, n)} />
                              ) : null}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {p.watchFor.length ? (
            <section aria-labelledby="h-watch" className="print-plain rounded-2xl border border-border-200 border-l-[6px] border-l-attn bg-white p-5">
              <SectionHeading id="h-watch" icon={<Eye size={20} />}>
                Watch for
              </SectionHeading>
              <p className="mt-1 text-sm text-ink-500">The clinic asked to be called if any of these happen.</p>
              <ul className="mt-2 list-disc space-y-1 pl-6 marker:text-attn">
                {p.watchFor.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </section>
          ) : null}

          {p.questions.length ? (
            <section aria-labelledby="h-q" className="print-plain rounded-2xl border border-border-200 bg-white p-5">
              <SectionHeading id="h-q" icon={<HelpCircle size={20} />}>
                Questions for next visit
              </SectionHeading>
              <ul className="mt-2 list-disc space-y-1 pl-6">
                {p.questions.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ul>
            </section>
          ) : null}

          {p.otherNotes.length ? (
            <section aria-labelledby="h-notes" className="print-plain rounded-2xl border border-border-200 bg-white p-5">
              <SectionHeading id="h-notes" icon={<NotebookPen size={20} />}>
                Other notes
              </SectionHeading>
              <ul className="mt-2 list-disc space-y-1 pl-6 text-ink-900/90">
                {p.otherNotes.map((n, i) => (
                  <li key={i}>{n}</li>
                ))}
              </ul>
            </section>
          ) : null}

          {p.visit.summary || p.visit.reason ? (
            <>
              <details className="no-print group rounded-2xl border border-border-200 bg-white">
                <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-2 rounded-2xl px-5 text-lg font-semibold text-primary-700 [&::-webkit-details-marker]:hidden">
                  Visit summary
                  <ChevronDown size={20} className="transition-transform group-open:rotate-180" aria-hidden="true" />
                </summary>
                <div className="px-5 pb-5">
                  {p.visit.reason ? (
                    <p>
                      <span className="font-medium">Reason:</span> {p.visit.reason}
                    </p>
                  ) : null}
                  {p.visit.summary ? <p className="mt-2">{p.visit.summary}</p> : null}
                </div>
              </details>
              <section className="print-only print-plain rounded-2xl border p-5">
                <h2 className="text-lg font-semibold">Visit summary</h2>
                {p.visit.reason ? <p>Reason: {p.visit.reason}</p> : null}
                {p.visit.summary ? <p className="mt-1">{p.visit.summary}</p> : null}
              </section>
            </>
          ) : null}
        </div>

        <div className="print-only mt-10">
          <p>Reviewed by: ________________________________ Date: ______________</p>
        </div>

        {creatorView || !onAck ? null : (
          <section aria-labelledby="ack-title" className="no-print mt-8 rounded-2xl border border-border-200 bg-white p-5">
            <h2 id="ack-title" className="sr-only">
              Acknowledge
            </h2>
            {acked ? (
              <div className="flex items-center gap-3" role="status">
                <span className="flex h-12 w-12 shrink-0 animate-pop items-center justify-center rounded-full bg-ok-bg text-ok">
                  <Check size={26} strokeWidth={3} aria-hidden="true" />
                </span>
                <p className="text-lg">{COPY.ackSuccess(acked, creator)}</p>
              </div>
            ) : (
              <form onSubmit={submitAck} noValidate>
                {invite ? (
                  <p className="text-ink-500">
                    Let {creator ?? "the person who shared this"} know you, {invite.recipientName}, have read this update.
                  </p>
                ) : (
                  <>
                    <label htmlFor={nameId} className="font-medium">
                      Your name
                    </label>
                    <input
                      id={nameId}
                      value={ackName}
                      onChange={(e) => setAckName(e.target.value)}
                      autoComplete="given-name"
                      maxLength={60}
                      className="mt-1 h-12 w-full rounded-xl border border-border-200 bg-white px-3 outline-none focus:border-action-500 focus:ring-2 focus:ring-action-500/30"
                    />
                  </>
                )}
                {ackError ? (
                  <p role="alert" className="mt-2 text-attn-ink">
                    {ackError}
                  </p>
                ) : null}
                <button
                  type="submit"
                  disabled={ackBusy}
                  className="mt-3 min-h-14 w-full rounded-xl bg-primary-700 px-5 text-lg font-semibold text-white hover:bg-primary-900 disabled:opacity-60"
                >
                  {ackBusy ? "Sending…" : "I've read this"}
                </button>
              </form>
            )}
          </section>
        )}

        {view.hasOriginal && originalUrl ? (
          <p className="no-print mt-6 text-center">
            <a href={originalUrl} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-2 text-ink-500 underline underline-offset-4">
              <FileText size={16} aria-hidden="true" /> View the clinic&apos;s original summary
            </a>
          </p>
        ) : null}

        <footer className="mt-8 border-t border-border-200 pt-6 text-sm text-ink-500">
          <p>
            This is a family summary prepared from the clinic&apos;s after-visit summary. It is not medical advice. Questions about care go to
            the clinic.
          </p>
          <div className="no-print mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border-200 bg-white px-3 font-medium text-primary-700 hover:bg-sky-100"
            >
              <Printer size={18} aria-hidden="true" /> Print
            </button>
            <button
              type="button"
              aria-pressed={large}
              onClick={toggleLarge}
              className={`inline-flex min-h-11 items-center gap-2 rounded-lg border px-3 font-medium hover:bg-sky-100 ${
                large ? "border-action-500 bg-sky-100 text-primary-900" : "border-border-200 bg-white text-primary-700"
              }`}
            >
              <Type size={18} aria-hidden="true" /> Large text
            </button>
          </div>
        </footer>
      </main>
    </div>
  );
}

/** Where an item came from: the clinic's sentence, or the caregiver. */
function Provenance({ quote, added, show, creator }: { quote?: string; added: boolean; show: boolean; creator?: string }) {
  if (added) {
    return <p className="mt-1 text-xs font-semibold tracking-wide text-ink-500 uppercase">Added by {creator ?? "the caregiver"}, not in the clinic&apos;s summary</p>;
  }
  if (!show || !quote) return null;
  return (
    <p className="mt-1.5 border-l-2 border-border-200 pl-3 text-sm text-ink-500 italic">
      <span className="not-italic font-medium">Clinic&apos;s words:</span> &ldquo;{quote}&rdquo;
    </p>
  );
}

function capitalize(s: string) {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}
