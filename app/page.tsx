import { ArrowRight, FileText, MessagesSquare, Pill, Upload } from "lucide-react";
import Link from "next/link";
import { ButtonLink } from "@/components/Button";
import { HandoffPreview } from "@/components/HandoffPreview";
import { HeroArtifact } from "@/components/home/HeroArtifact";
import { PageShell } from "@/components/PageShell";
import { StartSample } from "@/components/StartSample";

const PROBLEMS = [
  {
    icon: FileText,
    title: "The summary is written for the chart.",
    body: "Pages of codes and abbreviations. The two lines that changed are somewhere on page four.",
  },
  {
    icon: MessagesSquare,
    title: "Everyone hears a different version.",
    body: "Your sister gets a text, the aide gets a phone call, and the day program gets nothing at all.",
  },
  {
    icon: Pill,
    title: "The medication change gets lost.",
    body: "The one detail that has to reach whoever hands out the pills is the easiest one to miss.",
  },
];

const STEPS = [
  {
    title: "Add the summary",
    body: "Upload the PDF from the patient portal, take a photo of the printout, or paste the text. Photos are read on your phone.",
  },
  {
    title: "Check every line",
    body: "AfterVisit sorts it into what changed, what happens next and what to watch for. Anything unclear is flagged. Nothing is shared until you confirm each part.",
  },
  {
    title: "Send one link",
    body: "Add who should see it, then text or email the link. Each person taps “I've read this,” and you can see who has.",
  },
];

const SEES = [
  { title: "Medication changes come first.", body: "New, stopped and changed doses are flagged, so the person handing out pills cannot miss them." },
  { title: "Every task has a name on it.", body: "Tasks are grouped by who is doing them, with a date when there is one." },
  { title: "Warning signs in the clinic's words.", body: "Nothing is reworded into advice. AfterVisit organizes; it never interprets." },
  { title: "You know who has read it.", body: "Each person taps “I've read this,” and you see it on your private page." },
];

const PROMISES = [
  { title: "Nothing is saved until you share.", body: "Your draft stays in this browser tab, and photos are read on your device." },
  { title: "Gone in 30 days.", body: "Every link expires on its own. Delete it sooner from your private manage page." },
  { title: "No account. No ads.", body: "No sign-up, no tracking cookies, nothing to install." },
];

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-3 text-[0.8rem] font-bold tracking-[0.14em] text-primary-700 uppercase">
      <span aria-hidden="true" className="h-px w-6 bg-primary-700" />
      {children}
    </p>
  );
}

export default function Home() {
  return (
    <PageShell>
      <main id="main" className="flex-1 bg-white">
        {/* Hero */}
        <section className="overflow-x-clip">
          <div className="mx-auto grid max-w-[1120px] items-center gap-14 px-4 pt-12 pb-14 sm:px-6 sm:pt-20 lg:grid-cols-[1.08fr_0.92fr] lg:gap-10 lg:pt-24 lg:pb-20">
            <div>
              <Eyebrow>For family caregivers</Eyebrow>
              <h1 className="font-display mt-6 text-[2.45rem] leading-[1.04] font-normal text-ink-900 sm:text-[4.1rem]">
                Share the doctor&apos;s plan with everyone who helps.
              </h1>
              <p className="mt-6 max-w-[34rem] text-lg leading-relaxed text-ink-500 sm:text-[1.2rem]">
                Turn the after-visit summary from a medical appointment into one checked page for family, home aides and the day program.
              </p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
                <ButtonLink href="/new" className="min-h-14 px-6 text-[1.05rem]">
                  <Upload size={20} aria-hidden="true" /> Upload my summary
                </ButtonLink>
                <StartSample variant="soft" className="min-h-14 px-6 text-[1.05rem]" />
              </div>
              <p className="mt-5 text-[0.95rem] text-ink-500">Free. No account. Nothing is saved until you share.</p>
            </div>
            <HeroArtifact />
          </div>
        </section>

        <div className="mx-auto max-w-[1120px] px-4 sm:px-6">
          <p className="border-y border-border-200 py-4 text-center text-[0.8rem] font-bold tracking-[0.16em] text-primary-700 uppercase">
            Free <span className="mx-2 text-med" aria-hidden="true">•</span> No account <span className="mx-2 text-med" aria-hidden="true">•</span> Private by
            default <span className="mx-2 text-med" aria-hidden="true">•</span> Open source
          </p>
        </div>

        {/* The problem */}
        <section aria-labelledby="problem-title" className="py-20 sm:py-28">
          <div className="mx-auto max-w-[1120px] px-4 sm:px-6">
            <h2 id="problem-title" className="font-display max-w-3xl text-[2.1rem] leading-[1.1] text-ink-900 sm:text-[2.8rem]">
              You shouldn&apos;t have to explain it five times.
            </h2>
            <p className="mt-4 max-w-2xl text-lg text-ink-500">After every appointment, the same news has to reach the same people. Usually it doesn&apos;t, or not all of it.</p>
            <ul className="mt-14 grid gap-12 md:grid-cols-3 md:gap-10">
              {PROBLEMS.map(({ icon: Icon, title, body }) => (
                <li key={title}>
                  <Icon size={28} strokeWidth={1.6} className="text-med" aria-hidden="true" />
                  <h3 className="font-display mt-4 text-[1.45rem] leading-snug text-ink-900">{title}</h3>
                  <p className="mt-2 text-ink-500">{body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* How it works */}
        <section id="how" aria-labelledby="how-title" className="scroll-mt-20 border-t border-border-200 py-20 sm:py-28">
          <div className="mx-auto grid max-w-[1120px] gap-12 px-4 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
            <div className="lg:sticky lg:top-28 lg:self-start">
              <Eyebrow>How it works</Eyebrow>
              <h2 id="how-title" className="font-display mt-5 text-[2.1rem] leading-[1.1] text-ink-900 sm:text-[2.8rem]">
                From a stack of printouts to one clear page.
              </h2>
              <p className="mt-4 text-lg text-ink-500">About five minutes, start to finish.</p>
              <Link href="/h/demo" className="mt-6 inline-flex items-center gap-1.5 font-semibold text-primary-700 underline decoration-primary-700/30 underline-offset-[6px] hover:decoration-primary-700">
                See a finished handoff <ArrowRight size={18} aria-hidden="true" />
              </Link>
            </div>
            <ol className="divide-y divide-border-200 border-y border-border-200">
              {STEPS.map(({ title, body }, i) => (
                <li key={title} className="grid grid-cols-[3.5rem_1fr] gap-4 py-8 sm:grid-cols-[4.5rem_1fr]">
                  <span className="font-display text-[2.6rem] leading-none text-primary-700/80 sm:text-[3.2rem]" aria-hidden="true">
                    {i + 1}
                  </span>
                  <div>
                    <h3 className="text-[1.25rem] font-bold text-ink-900">
                      <span className="sr-only">Step {i + 1}: </span>
                      {title}
                    </h3>
                    <p className="mt-2 text-ink-500">{body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* What they see */}
        <section aria-labelledby="sees-title" className="bg-surface-50 py-20 sm:py-28">
          <div className="mx-auto grid max-w-[1120px] items-center gap-14 px-4 sm:px-6 lg:grid-cols-[1fr_1fr] lg:gap-20">
            <div className="lg:order-2">
              <Eyebrow>What they see</Eyebrow>
              <h2 id="sees-title" className="font-display mt-5 text-[2.1rem] leading-[1.1] text-ink-900 sm:text-[2.8rem]">
                A page anyone can read in a minute, on any phone.
              </h2>
              <dl className="mt-10 divide-y divide-border-200 border-t border-border-200">
                {SEES.map(({ title, body }) => (
                  <div key={title} className="py-5">
                    <dt className="text-[1.1rem] font-bold text-ink-900">{title}</dt>
                    <dd className="mt-1 text-ink-500">{body}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div className="lg:order-1">
              <HandoffPreview />
            </div>
          </div>
        </section>

        {/* Privacy */}
        <section aria-labelledby="privacy-title" className="py-20 sm:py-28">
          <div className="mx-auto max-w-[1120px] px-4 sm:px-6">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <h2 id="privacy-title" className="font-display text-[2.1rem] leading-[1.1] text-ink-900 sm:text-[2.8rem]">
                Private by default.
              </h2>
              <Link href="/privacy" className="inline-flex items-center gap-1.5 font-semibold text-primary-700 underline decoration-primary-700/30 underline-offset-[6px] hover:decoration-primary-700">
                Read the privacy page <ArrowRight size={18} aria-hidden="true" />
              </Link>
            </div>
            <ul className="mt-12 grid gap-10 md:grid-cols-3">
              {PROMISES.map(({ title, body }) => (
                <li key={title} className="border-t-2 border-ink-900 pt-5">
                  <h3 className="text-[1.15rem] font-bold text-ink-900">{title}</h3>
                  <p className="mt-2 text-ink-500">{body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Closing */}
        <section aria-labelledby="cta-title" className="px-4 pb-20 sm:px-6">
          <div className="mx-auto max-w-[1120px] rounded-3xl bg-primary-900 px-6 py-14 text-center sm:px-12 sm:py-20">
            <h2 id="cta-title" className="font-display mx-auto max-w-2xl text-[2.2rem] leading-[1.08] text-white sm:text-[3.2rem]">
              Have the summary from a recent visit?
            </h2>
            <p className="mt-4 text-lg text-white/75">Make it a handoff in about five minutes.</p>
            <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
              <ButtonLink href="/new" variant="light" className="min-h-14 px-6 text-[1.05rem]">
                <Upload size={20} aria-hidden="true" /> Upload my summary
              </ButtonLink>
              <StartSample variant="navy" className="min-h-14 px-6 text-[1.05rem]" />
            </div>
          </div>
        </section>
      </main>
    </PageShell>
  );
}
