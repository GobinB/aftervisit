import { ArrowRight, ClipboardList, FileText, MailCheck, MessagesSquare, Pill, Upload, UserCheck } from "lucide-react";
import Link from "next/link";
import { SOURCE_URL } from "@/components/AppBar";
import { ButtonLink } from "@/components/Button";
import { HeroArtifact } from "@/components/home/HeroArtifact";
import { Walkthrough } from "@/components/home/Walkthrough";
import { PageShell } from "@/components/PageShell";
import { StartSample } from "@/components/StartSample";
import { DEMO_MODE } from "@/lib/demo";

const BENEFITS = [
  { icon: ClipboardList, title: "Know what changed", body: "Medication updates, referrals, and follow-up instructions." },
  { icon: UserCheck, title: "Know who's responsible", body: "Assign next steps to people helping with care." },
  { icon: MailCheck, title: "Know who received it", body: "See self-reported read acknowledgments." },
];

const PROBLEMS = [
  {
    icon: FileText,
    title: "The summary is written for the chart.",
    body: "Pages of codes and abbreviations. The two lines that changed are somewhere on page four.",
  },
  {
    icon: MessagesSquare,
    title: "Everyone hears a different version.",
    body: "A sibling gets a text, the aide gets a phone call, and the day program gets nothing at all.",
  },
  {
    icon: Pill,
    title: "The medication change gets lost.",
    body: "The one detail that has to reach whoever hands out the pills is the easiest one to miss.",
  },
];

const PROMISES = [
  { title: "Nothing is saved while you draft.", body: "The summary is read to build your draft and isn't kept. Only what you confirm is saved." },
  { title: "PIN-protected by default.", body: "Anyone with a link can open it, so new handoffs also ask for a 4-digit PIN you send separately." },
  { title: "Gone in 30 days.", body: "Links expire on their own, and you can delete a handoff at any time." },
];

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-3 text-[0.8rem] font-bold tracking-[0.14em] text-primary-700 uppercase">
      <span aria-hidden="true" className="h-px w-6 bg-primary-700" />
      {children}
    </p>
  );
}

function SectionTitle({ id, children, className = "" }: { id: string; children: React.ReactNode; className?: string }) {
  return (
    <h2 id={id} className={`font-display text-[2.1rem] leading-[1.1] text-ink-900 sm:text-[2.8rem] ${className}`}>
      {children}
    </h2>
  );
}

export default function Home() {
  return (
    <PageShell>
      <main id="main" className="flex-1 bg-white">
        {/* Hero */}
        <section className="overflow-x-clip">
          <div className="mx-auto grid max-w-[1120px] items-center gap-14 px-4 pt-12 pb-14 sm:px-6 sm:pt-20 lg:grid-cols-[1.08fr_0.92fr] lg:gap-10 lg:pt-24 lg:pb-16">
            <div>
              <Eyebrow>For family caregivers</Eyebrow>
              <h1 className="font-display mt-6 text-[2.45rem] leading-[1.04] font-normal text-ink-900 sm:text-[4.1rem]">
                Share the doctor&apos;s plan with everyone who helps.
              </h1>
              <p className="mt-6 max-w-[36rem] text-lg leading-relaxed text-ink-500 sm:text-[1.15rem]">
                Turn an after-visit summary into one reviewed care update showing what changed, what needs to happen next, and who&apos;s
                responsible. Share it with family members, home aides, adult day programs, and care managers.
              </p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
                <StartSample variant="primary" label="Try a sample visit" className="min-h-14 px-6 text-[1.05rem]" />
                <ButtonLink href="/new" variant="soft" className="min-h-14 px-6 text-[1.05rem]">
                  <Upload size={20} aria-hidden="true" /> Upload a summary
                </ButtonLink>
              </div>
              <p className="mt-5 text-[0.95rem] text-ink-500">
                Free, no sign-up. The sample visit is fictional.
                {DEMO_MODE ? " This is a public prototype, so please don't upload real patient records yet." : ""}
              </p>
            </div>
            <HeroArtifact />
          </div>
        </section>

        {/* Benefits */}
        <section aria-label="What AfterVisit does" className="mx-auto max-w-[1120px] px-4 sm:px-6">
          <ul className="grid gap-px overflow-hidden rounded-2xl border border-border-200 bg-border-200 md:grid-cols-3">
            {BENEFITS.map(({ icon: Icon, title, body }) => (
              <li key={title} className="flex gap-4 bg-white p-6">
                <Icon size={24} strokeWidth={1.7} className="mt-0.5 shrink-0 text-primary-700" aria-hidden="true" />
                <div>
                  <h2 className="text-[1.1rem] font-bold text-ink-900">{title}</h2>
                  <p className="mt-1 text-ink-500">{body}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* The problem */}
        <section aria-labelledby="problem-title" className="py-20 sm:py-28">
          <div className="mx-auto max-w-[1120px] px-4 sm:px-6">
            <SectionTitle id="problem-title" className="max-w-3xl">
              You shouldn&apos;t have to explain it five times.
            </SectionTitle>
            <p className="mt-4 max-w-2xl text-lg text-ink-500">
              After every appointment, the same news has to reach the same people. Usually it doesn&apos;t, or not all of it.
            </p>
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

        {/* Walkthrough */}
        <section id="how" aria-labelledby="how-title" className="scroll-mt-20 bg-surface-50 py-20 sm:py-28">
          <div className="mx-auto max-w-[1120px] px-4 sm:px-6">
            <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
              <div>
                <Eyebrow>How it works</Eyebrow>
                <SectionTitle id="how-title" className="mt-5 max-w-2xl">
                  Follow one fictional visit, start to finish.
                </SectionTitle>
              </div>
              <StartSample variant="soft" label="Walk through it yourself" className="self-start lg:self-auto" />
            </div>
            <div className="mt-12">
              <Walkthrough />
            </div>
          </div>
        </section>

        {/* Privacy */}
        <section aria-labelledby="privacy-title" className="py-20 sm:py-28">
          <div className="mx-auto max-w-[1120px] px-4 sm:px-6">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <SectionTitle id="privacy-title">Careful with health information.</SectionTitle>
              <Link
                href="/privacy"
                className="inline-flex items-center gap-1.5 font-semibold text-primary-700 underline decoration-primary-700/30 underline-offset-[6px] hover:decoration-primary-700"
              >
                Read exactly what is stored <ArrowRight size={18} aria-hidden="true" />
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

        {/* Founder */}
        <section aria-labelledby="founder-title" className="border-t border-border-200 py-20 sm:py-28">
          <div className="mx-auto grid max-w-[1120px] gap-10 px-4 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
            <div>
              <Eyebrow>Why I started AfterVisit</Eyebrow>
              <p className="mt-6 font-semibold text-ink-900">Gobin Bastola</p>
              <p className="text-ink-500">Founder</p>
              <a
                href={SOURCE_URL}
                target="_blank"
                rel="noreferrer"
                className="mt-6 inline-flex items-center gap-1.5 font-semibold text-primary-700 underline decoration-primary-700/30 underline-offset-[6px] hover:decoration-primary-700"
              >
                Read the source code on GitHub <ArrowRight size={18} aria-hidden="true" />
              </a>
              <p className="mt-2 text-sm text-ink-500">Open source under the AGPL-3.0 license.</p>
            </div>
            <figure>
              <blockquote id="founder-title" className="font-display text-[1.6rem] leading-[1.35] text-ink-900 sm:text-[2rem]">
                &ldquo;After five years working with Medicaid billing for an adult day health center, I&apos;ve seen how many different people
                are involved in supporting aging adults. AfterVisit started with a simple question: what if the important information from a
                medical appointment reached everyone helping with care, without families having to explain it over and over?&rdquo;
              </blockquote>
            </figure>
          </div>
        </section>

        {/* Closing */}
        <section aria-labelledby="cta-title" className="px-4 pb-20 sm:px-6">
          <div className="mx-auto max-w-[1120px] rounded-3xl bg-primary-900 px-6 py-14 text-center sm:px-12 sm:py-20">
            <h2 id="cta-title" className="font-display mx-auto max-w-2xl text-[2.2rem] leading-[1.08] text-white sm:text-[3.2rem]">
              See it with a fictional visit first.
            </h2>
            <p className="mt-4 text-lg text-white/75">No sign-up. Takes about two minutes.</p>
            <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
              <StartSample variant="light" label="Try a sample visit" className="min-h-14 px-6 text-[1.05rem]" />
              <ButtonLink href="/new" variant="navy" className="min-h-14 px-6 text-[1.05rem]">
                <Upload size={20} aria-hidden="true" /> Upload a summary
              </ButtonLink>
            </div>
          </div>
        </section>
      </main>
    </PageShell>
  );
}
