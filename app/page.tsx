import { ArrowRight, FileText, MessagesSquare, Pill } from "lucide-react";
import Link from "next/link";
import { SOURCE_URL } from "@/components/AppBar";
import { ButtonLink } from "@/components/Button";
import { HeroArtifact } from "@/components/home/HeroArtifact";
import { Walkthrough } from "@/components/home/Walkthrough";
import { PageShell } from "@/components/PageShell";
import { StartSample } from "@/components/StartSample";
import { DEMO_MODE } from "@/lib/demo";
import { MEMBER_TTL_DAYS } from "@/lib/schema/circles";

/** Where a caregiver starts. /circles/new sends a signed-out visitor to Google sign-in first. */
const START_HREF = "/circles/new";

const PILLARS = [
  { title: "Free", body: "No cost for families, or for anyone helping them." },
  { title: "Private by design", body: "Each person sees only what you choose. Files are encrypted on your phone before they are uploaded." },
  { title: "Nonprofit and open source", body: "Built to help families, not to sell their data. Anyone can read the code." },
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

/** `ready: false` shows "Coming this month". Flip it when the module ships. */
const MODULES = [
  {
    title: "The people who help",
    body: "Family, home aides, the day program and care managers. Each gets a role and a personal link, and you can turn any link off.",
    ready: true,
  },
  {
    title: "Medication list",
    body: "Which pills, which dose, as of today. Every change is dated with where it came from, and the list prints on one page.",
    ready: false,
  },
  {
    title: "Tasks",
    body: "Who is calling the insurance company, and by when. Anyone you allow can tap “I’ll do it.”",
    ready: false,
  },
  {
    title: "After-visit handoff",
    body: "Upload the visit summary, check it and confirm. The medication list and tasks update, and everyone sees what changed.",
    ready: false,
  },
];

const STEPS = [
  {
    title: "Sign in and start the page.",
    body: "Sign in with Google and add the person you care for. You get 12 recovery words to keep somewhere safe. They open your files on a new phone.",
  },
  {
    title: "Add the people who help.",
    body: "Each person gets a private link to just the parts you choose. They don’t need an account or an app.",
  },
  {
    title: "Keep it current after each visit.",
    body: "Upload the after-visit summary. The medication list and tasks update, so nobody has to explain it five times.",
  },
];

const PROMISES = [
  { title: "Only what you choose.", body: "Each person sees only the parts you pick for them. You can turn off anyone’s link at any time." },
  {
    title: "Files encrypted on your phone.",
    body: "Documents and photos are encrypted before they leave your phone. AfterVisit stores them but can’t open them.",
  },
  {
    title: "Links that expire.",
    body: `Every link is a long random code, saved only as a one-way hash. Links stop working after ${MEMBER_TTL_DAYS} days unless you renew them.`,
  },
];

function Eyebrow({ children, showLine = true }: { children: React.ReactNode; showLine?: boolean }) {
  return (
    <p className="flex items-center gap-3 text-[0.8rem] font-bold tracking-[0.14em] text-primary-700 uppercase">
      {showLine && <span aria-hidden="true" className="h-px w-6 bg-primary-700" />}
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
              <Eyebrow showLine={false}>Free · Private by design · Nonprofit</Eyebrow>
              <h1 className="font-display mt-6 text-[2.45rem] leading-[1.04] font-normal text-ink-900 sm:text-[4.1rem]">
                One shared care page for the person you look after.
              </h1>
              <p className="mt-6 max-w-[36rem] text-lg leading-relaxed text-ink-500 sm:text-[1.15rem]">
                Keep their medications, tasks and the latest doctor&apos;s visit in one place. Give family, home aides and the day program
                their own private link to just the parts they need.
              </p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
                <ButtonLink href={START_HREF} variant="primary" className="min-h-14 px-6 text-[1.05rem]">
                  Start a care circle <ArrowRight size={20} aria-hidden="true" />
                </ButtonLink>
                <StartSample variant="soft" label="Try a sample visit" className="min-h-14 px-6 text-[1.05rem]" />
              </div>
              <p className="mt-5 max-w-[36rem] text-[0.95rem] text-ink-500">
                Caregivers sign in with Google. Everyone else opens their own link, with no account.
                {DEMO_MODE ? " This is an early version, so please use made-up details for now." : ""}
              </p>
            </div>
            <HeroArtifact />
          </div>
        </section>

        {/* Pillars */}
        <section aria-label="What AfterVisit stands for" className="mx-auto max-w-[1120px] px-4 sm:px-6">
          <ul className="grid gap-8 border-y border-border-200 py-10 md:grid-cols-3 md:gap-10">
            {PILLARS.map(({ title, body }) => (
              <li key={title}>
                <h2 className="font-display text-[1.6rem] leading-tight text-primary-900">{title}</h2>
                <p className="mt-2 text-ink-500">{body}</p>
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

        {/* What's in a care circle */}
        <section aria-labelledby="circle-title" className="bg-surface-50 py-20 sm:py-28">
          <div className="mx-auto max-w-[1120px] px-4 sm:px-6">
            <Eyebrow>The care circle</Eyebrow>
            <SectionTitle id="circle-title" className="mt-5 max-w-3xl">
              Everything about their care, on one page.
            </SectionTitle>
            <ul className="mt-12 grid gap-10 md:grid-cols-2 md:gap-x-12">
              {MODULES.map(({ title, body, ready }) => (
                <li key={title} className="border-t-2 border-ink-900 pt-5">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <h3 className="text-[1.15rem] font-bold text-ink-900">{title}</h3>
                    {ready ? null : (
                      <span className="rounded-full bg-sky-100 px-2.5 py-0.5 text-[0.75rem] font-bold tracking-wider text-primary-900 uppercase">
                        Coming this month
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-ink-500">{body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* How it works */}
        <section id="how" aria-labelledby="how-title" className="scroll-mt-20 py-20 sm:py-28">
          <div className="mx-auto max-w-[1120px] px-4 sm:px-6">
            <Eyebrow>How it works</Eyebrow>
            <SectionTitle id="how-title" className="mt-5 max-w-3xl">
              Set it up once. Everyone stays up to date.
            </SectionTitle>
            <ol className="mt-12 grid gap-10 md:grid-cols-3">
              {STEPS.map(({ title, body }, index) => (
                <li key={title}>
                  <p className="font-display text-[2.4rem] leading-none text-primary-700">{index + 1}</p>
                  <h3 className="mt-4 text-[1.15rem] font-bold text-ink-900">{title}</h3>
                  <p className="mt-2 text-ink-500">{body}</p>
                </li>
              ))}
            </ol>
            <div className="mt-12 flex flex-col gap-3 sm:flex-row sm:items-center">
              <ButtonLink href={START_HREF} variant="primary" className="min-h-14 px-6 text-[1.05rem]">
                Start a care circle <ArrowRight size={20} aria-hidden="true" />
              </ButtonLink>
              <p className="text-ink-500">Free. You need a Google account to sign in.</p>
            </div>
          </div>
        </section>

        {/* Sample walkthrough */}
        <section id="sample" aria-labelledby="sample-title" className="scroll-mt-20 border-t border-border-200 bg-surface-50 py-20 sm:py-28">
          <div className="mx-auto max-w-[1120px] px-4 sm:px-6">
            <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
              <div>
                <Eyebrow>No sign-in needed</Eyebrow>
                <SectionTitle id="sample-title" className="mt-5 max-w-2xl">
                  Try the after-visit handoff with a fictional visit.
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
              Start a care page for someone you look after.
            </h2>
            <p className="mt-4 text-lg text-white/75">Free. Sign in with Google. Helpers never need an account.</p>
            <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
              <ButtonLink href={START_HREF} variant="light" className="min-h-14 px-6 text-[1.05rem]">
                Start a care circle <ArrowRight size={20} aria-hidden="true" />
              </ButtonLink>
              <StartSample variant="navy" label="Try a sample visit" className="min-h-14 px-6 text-[1.05rem]" />
            </div>
          </div>
        </section>
      </main>
    </PageShell>
  );
}
