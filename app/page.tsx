import { BellOff, Building2, CheckCircle2, ClipboardCheck, Clock, HeartHandshake, KeyRound, Lock, Share2, ShieldCheck, Upload, UserRound } from "lucide-react";
import Link from "next/link";
import { ButtonLink } from "@/components/Button";
import { HandoffPreview } from "@/components/HandoffPreview";
import { PageShell } from "@/components/PageShell";
import { StartSample } from "@/components/StartSample";

const STEPS = [
  { icon: Upload, title: "Add the summary", body: "Upload the PDF from the patient portal, snap a photo of the printout, or paste the text." },
  { icon: ClipboardCheck, title: "Check each item", body: "We sort it into changes, next steps and things to watch for. You fix anything and confirm." },
  { icon: Share2, title: "Share one link", body: "Text or email it. Everyone reads the same clear page and taps “I've read this.”" },
];

const READERS = [
  { icon: HeartHandshake, title: "Family", body: "What changed, and which tasks are theirs, in 60 seconds on a phone." },
  { icon: UserRound, title: "Home aide", body: "Medication changes and what to watch for, written plainly." },
  { icon: Building2, title: "Day program", body: "A printable page with the visit date and clinician, ready for the file." },
];

const PRIVACY = [
  { icon: Lock, title: "Nothing is saved until you share", body: "Your draft stays on your device while you work." },
  { icon: Clock, title: "Links expire in 30 days", body: "And you can delete a handoff at any time." },
  { icon: KeyRound, title: "Private link, optional PIN", body: "Only people you send it to can open it." },
  { icon: BellOff, title: "No account, no ads", body: "No sign-up, no tracking cookies, nothing to install." },
];

export default function Home() {
  return (
    <PageShell>
      <main id="main" className="flex-1">
        {/* Hero */}
        <section className="overflow-x-clip bg-gradient-to-b from-white to-surface-50">
          <div className="mx-auto grid max-w-[1100px] items-center gap-12 px-4 pt-10 pb-16 sm:pt-16 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16 lg:pt-20 lg:pb-24">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full bg-sky-100 px-3 py-1 text-sm font-semibold text-primary-700">
                <ShieldCheck size={16} aria-hidden="true" /> For family caregivers
              </p>
              <h1 className="mt-5 text-[2.1rem] leading-[1.12] font-semibold tracking-tight text-primary-900 sm:text-5xl">
                Turn an after-visit summary into a care handoff everyone understands.
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-500 sm:text-xl">
                Pull out what changed and what needs to happen next. Confirm every item, then share one read-only page with the people who help.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <ButtonLink href="/new" className="min-h-14 px-6 text-[1.05rem] sm:min-w-56">
                  <Upload size={20} aria-hidden="true" /> Upload my summary
                </ButtonLink>
                <StartSample className="min-h-14 px-6 text-[1.05rem] sm:min-w-56" />
              </div>
              <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink-500">
                {["About 5 minutes", "No account needed", "Free"].map((t) => (
                  <li key={t} className="flex items-center gap-1.5">
                    <CheckCircle2 size={16} className="text-ok" aria-hidden="true" /> {t}
                  </li>
                ))}
              </ul>
            </div>
            <HandoffPreview />
          </div>
        </section>

        {/* How it works */}
        <section id="how" aria-labelledby="how-title" className="scroll-mt-20 border-t border-border-200 bg-white py-16 sm:py-20">
          <div className="mx-auto max-w-[1100px] px-4">
            <h2 id="how-title" className="text-center text-[1.75rem] font-semibold tracking-tight text-primary-900 sm:text-3xl">
              How it works
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-center text-ink-500">Three steps. You stay in control the whole way.</p>
            <ol className="relative mt-12 grid gap-10 md:grid-cols-3 md:gap-8">
              <div aria-hidden="true" className="absolute top-7 right-[16%] left-[16%] hidden h-0.5 bg-border-200 md:block" />
              {STEPS.map(({ icon: Icon, title, body }, i) => (
                <li key={title} className="relative flex flex-col items-center text-center">
                  <span className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-700 text-white shadow-md ring-8 ring-white">
                    <Icon size={24} aria-hidden="true" />
                    <span className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-white text-xs font-bold text-primary-700 ring-2 ring-primary-700">
                      {i + 1}
                    </span>
                  </span>
                  <h3 className="mt-5 text-lg font-semibold text-primary-900">{title}</h3>
                  <p className="mt-2 max-w-xs text-ink-500">{body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Who reads it */}
        <section aria-labelledby="readers-title" className="py-16 sm:py-20">
          <div className="mx-auto max-w-[1100px] px-4">
            <h2 id="readers-title" className="text-center text-[1.75rem] font-semibold tracking-tight text-primary-900 sm:text-3xl">
              One page for everyone who helps
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-center text-ink-500">Stop repeating the same update five times. Share it once.</p>
            <ul className="mt-10 grid gap-4 md:grid-cols-3">
              {READERS.map(({ icon: Icon, title, body }) => (
                <li key={title} className="rounded-2xl border border-border-200 bg-white p-6">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-100 text-primary-700">
                    <Icon size={22} aria-hidden="true" />
                  </span>
                  <h3 className="mt-4 text-lg font-semibold text-primary-900">{title}</h3>
                  <p className="mt-1.5 text-ink-500">{body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Privacy */}
        <section aria-labelledby="privacy-title" className="pb-16 sm:pb-20">
          <div className="mx-auto max-w-[1100px] px-4">
            <div className="rounded-3xl bg-primary-900 p-6 text-white sm:p-10">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 id="privacy-title" className="text-[1.6rem] font-semibold tracking-tight sm:text-3xl">
                    Private by design
                  </h2>
                  <p className="mt-2 max-w-lg text-white/80">Health information is personal. AfterVisit keeps as little as it can, for as short a time as it can.</p>
                </div>
                <Link href="/privacy" className="shrink-0 font-semibold text-[#C9DEF7] underline underline-offset-4 hover:text-white">
                  Read the privacy page
                </Link>
              </div>
              <ul className="mt-8 grid gap-4 sm:grid-cols-2">
                {PRIVACY.map(({ icon: Icon, title, body }) => (
                  <li key={title} className="flex gap-3.5 rounded-2xl bg-white/[0.07] p-4 ring-1 ring-white/10">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-[#C9DEF7]">
                      <Icon size={20} aria-hidden="true" />
                    </span>
                    <div>
                      <h3 className="font-semibold">{title}</h3>
                      <p className="mt-0.5 text-sm text-white/75">{body}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Closing call to action */}
        <section aria-labelledby="cta-title" className="pb-20">
          <div className="mx-auto max-w-[1100px] px-4">
            <div className="flex flex-col items-center rounded-3xl border border-border-200 bg-white px-6 py-12 text-center">
              <h2 id="cta-title" className="text-[1.6rem] font-semibold tracking-tight text-primary-900 sm:text-3xl">
                Have a summary from a recent visit?
              </h2>
              <p className="mt-3 max-w-md text-ink-500">Turn it into a handoff in about five minutes. Or try the sample first to see how it works.</p>
              <div className="mt-7 flex w-full flex-col justify-center gap-3 sm:w-auto sm:flex-row">
                <ButtonLink href="/new" className="min-h-14 px-6 sm:min-w-56">
                  <Upload size={20} aria-hidden="true" /> Upload my summary
                </ButtonLink>
                <StartSample className="min-h-14 px-6 sm:min-w-56" />
              </div>
            </div>
          </div>
        </section>
      </main>
    </PageShell>
  );
}
