import { CheckCircle2, CircleDashed, KeyRound, Link2 } from "lucide-react";
import { MedBadge } from "@/components/Badge";
import { SAMPLE_ASSIGNEES, SAMPLE_CAREGIVER, SAMPLE_DRAFT, SAMPLE_RECIPIENTS } from "@/lib/sample";
import { ROLE_LABELS } from "@/lib/schema";
import { SamplePrintout } from "./SamplePrintout";

const ROLE_NOTE: Record<string, string> = { Lisa: "Margaret's daughter" };

/** Fictional read receipts for the walkthrough (self-reported, as in the product). */
const READS: Record<string, string | null> = {
  Lisa: "Oct 4, 8:02 PM",
  Rosa: "Oct 5, 9:14 AM",
  Dana: "Oct 5, 11:30 AM",
  "Sunrise Adult Day Health": null,
};

function Step({ n, title, body, children }: { n: number; title: string; body: string; children: React.ReactNode }) {
  return (
    <li className="grid gap-6 border-t border-border-200 py-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
      <div>
        <span className="font-display text-[2.6rem] leading-none text-primary-700/80" aria-hidden="true">
          {n}
        </span>
        <h3 className="mt-3 text-[1.3rem] font-bold text-ink-900">
          <span className="sr-only">Step {n}: </span>
          {title}
        </h3>
        <p className="mt-2 text-ink-500">{body}</p>
      </div>
      <div className="min-w-0">{children}</div>
    </li>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border border-border-200 bg-white p-5 shadow-[0_12px_30px_-22px_rgb(28_36_51/0.35)]">{children}</div>;
}

/** The fictional sample, step by step: original summary to acknowledgment. */
export function Walkthrough() {
  const d = SAMPLE_DRAFT;
  const tasks = d.tasks.map((t) => ({ ...t, assignee: SAMPLE_ASSIGNEES[t.id] }));
  const roleOf = (name?: string) => SAMPLE_RECIPIENTS.find((r) => r.name === name)?.role;

  return (
    <ol>
      <Step
        n={1}
        title="The clinic's after-visit summary"
        body="Margaret, 82 and fictional, saw Dr. Patel about her blood pressure and dizziness. This is the summary the clinic printed. Every instruction is highlighted."
      >
        <div tabIndex={0} role="region" aria-label="Fictional after-visit summary" className="max-h-[460px] overflow-y-auto rounded-[3px]">
          <SamplePrintout />
        </div>
      </Step>

      <Step
        n={2}
        title="Checked against the summary"
        body={`${SAMPLE_CAREGIVER}, the family caregiver, reviews each item AfterVisit drafted. Every one links back to the clinic's exact words.`}
      >
        <Panel>
          <ul className="divide-y divide-border-200">
            {d.medications.map((m) => (
              <li key={m.id} className="py-3 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{m.name}</span>
                  <MedBadge kind={m.kind} />
                  <CheckCircle2 size={16} className="ml-auto text-ok" aria-label="Reviewed" />
                </div>
                <p className="mt-0.5">{m.detail}</p>
                <p className="mt-1.5 border-l-2 border-border-200 pl-3 text-sm text-ink-500 italic">
                  <span className="font-medium not-italic">Clinic&apos;s words:</span> &ldquo;{m.sourceQuote}&rdquo;
                </p>
              </li>
            ))}
          </ul>
        </Panel>
      </Step>

      <Step
        n={3}
        title="Each next step gets a name"
        body={`The clinic wrote the instructions. ${SAMPLE_CAREGIVER} decides who handles each one: Margaret's daughter, home aide and care manager.`}
      >
        <Panel>
          <ul className="space-y-3">
            {tasks.map((t) => {
              const role = roleOf(t.assignee);
              return (
                <li key={t.id} className="grid grid-cols-[7.5rem_1fr] gap-3 text-[0.95rem] sm:grid-cols-[9rem_1fr]">
                  <div>
                    <p className="font-semibold">{t.assignee}</p>
                    <p className="text-xs text-ink-500">{ROLE_NOTE[t.assignee ?? ""] ?? (role ? ROLE_LABELS[role] : "")}</p>
                  </div>
                  <div>
                    <p>{t.title}</p>
                    {t.dueText ? <p className="text-sm text-ink-500">When: {t.dueText}</p> : null}
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="mt-4 border-t border-border-200 pt-3 text-sm text-ink-500">Instructions: from the clinic. Assignments: from {SAMPLE_CAREGIVER}.</p>
        </Panel>
      </Step>

      <Step
        n={4}
        title="A personal link for each person"
        body={`Each person gets their own link and sees only what ${SAMPLE_CAREGIVER} chose. The day program sees just the medication changes and what to watch for. A PIN, sent separately, adds protection.`}
      >
        <Panel>
          <ul className="divide-y divide-border-200">
            {SAMPLE_RECIPIENTS.map((r) => (
              <li key={r.name} className="flex flex-wrap items-baseline justify-between gap-x-3 py-2.5 first:pt-0">
                <span className="font-medium">
                  {r.name} <span className="text-sm font-normal text-ink-500">· {ROLE_NOTE[r.name] ?? ROLE_LABELS[r.role]}</span>
                </span>
                <span className="text-sm text-ink-500">{r.sections ? "Sees medication changes, watch for" : "Sees everything"}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 grid gap-2 border-t border-border-200 pt-4 text-sm sm:grid-cols-2">
            <p className="flex items-center gap-2 text-ink-900">
              <Link2 size={16} className="text-primary-700" aria-hidden="true" /> 4 personal links
            </p>
            <p className="flex items-center gap-2 text-ink-900">
              <KeyRound size={16} className="text-primary-700" aria-hidden="true" /> PIN sent separately
            </p>
          </div>
        </Panel>
      </Step>

      <Step
        n={5}
        title="Who has read it, and what's done"
        body={`Each person taps “I've read this” and marks their own steps as they go. ${SAMPLE_CAREGIVER} sees it all on a private page, and knows whom to follow up with.`}
      >
        <Panel>
          <ul className="divide-y divide-border-200">
            {SAMPLE_RECIPIENTS.map((r) => {
              const at = READS[r.name];
              return (
                <li key={r.name} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                  <span className="flex items-center gap-2 font-medium">
                    {at ? (
                      <CheckCircle2 size={18} className="text-ok" aria-hidden="true" />
                    ) : (
                      <CircleDashed size={18} className="text-ink-500" aria-hidden="true" />
                    )}
                    {r.name}
                  </span>
                  <span className={`text-sm ${at ? "text-ink-500" : "font-medium text-med-ink"}`}>{at ? `Read ${at}` : "Not yet"}</span>
                </li>
              );
            })}
          </ul>
          <div className="mt-4 rounded-xl bg-ok-bg/60 px-3.5 py-2.5 text-[0.95rem]">
            <p className="flex items-center gap-2 font-medium text-ok-ink">
              <CheckCircle2 size={16} aria-hidden="true" /> Completed: Call to schedule physical therapy
            </p>
            <p className="mt-0.5 text-sm text-ink-900/80">Marked by Lisa through Lisa&apos;s personal link. Note: booked for Oct 15.</p>
          </div>
          <p className="mt-4 border-t border-border-200 pt-3 text-sm text-ink-500">
            Recorded through each person&apos;s own link: it shows which link was used, not who was holding the phone.
          </p>
        </Panel>
      </Step>
    </ol>
  );
}
