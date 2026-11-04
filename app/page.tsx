import { ArrowRight, Check, FileText, MessagesSquare, Pill } from "lucide-react";
import Link from "next/link";
import { SOURCE_URL } from "@/components/AppBar";
import { ButtonLink } from "@/components/Button";
import { AppPreview } from "@/components/home/AppPreview";
import { Walkthrough } from "@/components/home/Walkthrough";
import { PageShell } from "@/components/PageShell";
import { StartSample } from "@/components/StartSample";
import { DEMO_MODE } from "@/lib/demo";
import { MEMBER_TTL_DAYS } from "@/lib/schema/circles";

/** Where a caregiver starts. /circles/new sends a signed-out visitor to Google sign-in first. */
const START_HREF = "/circles/new";

const PILLARS = [
  { title: "Free", body: "No cost for families, or for anyone helping them." },
  { title: "Private by design", body: "Each person sees only what you choose, and you can turn off anyone’s link at any time." },
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

/**
 * What the page may promise. The pull request that ships a module sets `ready: true` and adds
 * its section below, with a real screen in <AppPreview>. Until then it is listed as "Not available yet",
 * and any step that needs it stays hidden.
 */
const MODULES = [
  {
    key: "people",
    title: "The people who help",
    body: "Family, home aides, the day program and care managers. Each gets a role and a personal link, and you can turn any link off.",
    ready: true,
  },
  {
    key: "summary",
    title: "Care summary",
    body: "Allergies, doctors, the pharmacy and emergency contacts, so whoever is helping has them in a hurry.",
    ready: true,
  },
  {
    key: "medications",
    title: "Medication list",
    body: "Which pills, which dose, as of today. Every change is dated with where it came from, and the list prints on one page.",
    ready: true,
  },
  {
    key: "calendar",
    title: "Calendar",
    body: "Appointments, therapy and visits in one place, with who is going and where. Ask for someone to go, and family can say “I’ll go.”",
    ready: true,
  },
  {
    key: "tasks",
    title: "To-dos",
    body: "Who is calling the insurance company, and by when. Anyone you allow can tap “I’ll do it.”",
    ready: true,
  },
  {
    key: "handoff",
    title: "After-visit handoff",
    body: "Upload the visit summary, check it and confirm. The medication list and to-dos update, and everyone you allow sees them.",
    ready: true,
  },
] as const;

type ModuleKey = (typeof MODULES)[number]["key"];
const ready = (key: ModuleKey) => MODULES.some((item) => item.key === key && item.ready);

const STEPS: { title: string; body: string; needs?: ModuleKey }[] = [
  {
    title: "Sign in and start the page.",
    body: "Sign in with Google and add the person you care for. You get 12 recovery words to keep somewhere safe. They restore your circle’s private key on a new phone.",
  },
  {
    title: "Add the people who help.",
    body: "Each person gets a private link to just the parts you choose. They don’t need an account or an app.",
  },
  {
    title: "Keep it current after each visit.",
    body: "Upload the after-visit summary. The medication list and tasks update, so nobody has to explain it five times.",
    needs: "handoff",
  },
];

const PEOPLE_POINTS = [
  "Pick each person’s role, and the parts of the page they see.",
  "Add a 4-digit PIN to any link if you want one.",
  "See when each person last opened their link.",
  "Turn off any link, or make a new one, at any time.",
];

const CALENDAR_POINTS = [
  "Appointments with time, place and notes, once or repeating.",
  "Mark who is going, or ask for someone to go.",
  "Family can add dates and say “I’ll go” from their link.",
  "To-dos show on the day they are due.",
];

const TODO_POINTS = [
  "Give a to-do to someone, keep it, or ask for a volunteer.",
  "Family can tap “I’ll do it” from their own link.",
  "Aides and the day program see only the to-dos that are theirs.",
  "Overdue ones stand out, and done ones stay on the list.",
];

const MEDICATION_POINTS = [
  "Strength, how much, when, and what it is for, in plain words.",
  "Stopping one keeps it on the record, with the date.",
  "Every change is listed with its date.",
  "Prints on one page for the pharmacy or a new aide.",
];

const SUMMARY_POINTS = [
  "Allergies come first, where nobody can miss them.",
  "Doctors, the pharmacy and emergency contacts, with their phone numbers.",
  "Hide it from anyone who doesn’t need it.",
];

const PROMISES = [
  { title: "Only what you choose.", body: "Each person sees only the parts you pick for them. You can turn off anyone’s link at any time." },
  {
    title: "A PIN if you want one.",
    body: "Add a 4-digit PIN to any link. Three wrong tries lock that link, and nobody else’s.",
  },
  {
    title: "Links that expire.",
    body: `Every link is a long random code, saved only as a one-way hash. A link stops working after ${MEMBER_TTL_DAYS} days without being opened.`,
  },
];

function Eyebrow({ children, showLine = true }: { children: React.ReactNode; showLine?: boolean }) {
  return (
    <p className="flex items-center gap-3 text-eyebrow font-bold tracking-[0.14em] text-primary-700 uppercase">
      {showLine && <span aria-hidden="true" className="h-px w-6 bg-primary-700" />}
      {children}
    </p>
  );
}

function Points({ items }: { items: string[] }) {
  return (
    <ul className="mt-8 space-y-4">
      {items.map((point) => (
        <li key={point} className="flex gap-3 border-t border-border-200 pt-4 text-ink-900">
          <Check size={20} strokeWidth={2.5} className="mt-0.5 shrink-0 text-primary-700" aria-hidden="true" />
          {point}
        </li>
      ))}
    </ul>
  );
}

function SectionTitle({ id, children, className = "" }: { id: string; children: React.ReactNode; className?: string }) {
  return (
    <h2 id={id} className={`font-display text-heading text-primary-900 sm:text-heading-lg ${className}`}>
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
              <h1 className="font-display mt-6 text-hero font-normal text-primary-900 sm:text-hero-lg">
                One shared care page for the person you look after.
              </h1>
              <p className="mt-6 max-w-[36rem] text-lg leading-relaxed text-ink-500 sm:text-item">
                Give family, home aides and the day program their own private link to just the parts they need, and see when each one last
                opened it.
              </p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
                <ButtonLink href={START_HREF} variant="primary" className="min-h-14 px-6 text-cta">
                  Start a care circle <ArrowRight size={20} aria-hidden="true" />
                </ButtonLink>
                <StartSample variant="secondary" label="Try a sample visit" className="min-h-14 px-6 text-cta" />
              </div>
              <p className="mt-5 max-w-[36rem] text-ui text-ink-500">
                Caregivers sign in with Google. Everyone else opens their own link, with no account.
                {DEMO_MODE ? " This is an early version, so please use made-up details for now." : ""}
              </p>
            </div>
            <AppPreview screen="overview" className="lg:pl-4" />
          </div>
        </section>

        {/* Pillars */}
        <section aria-label="What All Hands Care stands for" className="mx-auto max-w-[1120px] px-4 sm:px-6">
          <ul className="grid gap-8 border-y border-border-200 py-10 md:grid-cols-3 md:gap-10">
            {PILLARS.map(({ title, body }) => (
              <li key={title}>
                <h2 className="font-display text-section leading-tight text-primary-900">{title}</h2>
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
                  <h3 className="font-display mt-4 text-card text-primary-900">{title}</h3>
                  <p className="mt-2 text-ink-500">{body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* The modules: one section for each part that is built */}
        <section aria-labelledby="circle-title" className="border-t border-border-200 bg-surface-50 py-20 sm:py-28">
          <div className="mx-auto max-w-[1120px] px-4 sm:px-6">
            <Eyebrow>The care circle</Eyebrow>
            <SectionTitle id="circle-title" className="mt-5 max-w-3xl">
              One page, with a part for each piece of their care.
            </SectionTitle>
            <ul className="mt-10 flex flex-wrap gap-x-8 gap-y-3 border-b border-border-200 pb-5">
              {MODULES.map(({ key, title, ready }) => (
                <li key={key} className="flex items-center gap-2">
                  {ready ? (
                    <a href={key === "handoff" ? "#sample" : `#module-${key}`} className="inline-flex items-center gap-2 font-semibold text-ink-900 hover:text-primary-700">
                      <Check size={18} strokeWidth={2.5} className="text-ok" aria-hidden="true" />
                      {title}
                    </a>
                  ) : (
                    <>
                      <span className="text-ink-500">{title}</span>
                      <span className="rounded-full bg-white px-2.5 py-0.5 text-tag font-bold tracking-wider text-primary-900 uppercase ring-1 ring-border-200">
                        Not available yet
                      </span>
                    </>
                  )}
                </li>
              ))}
            </ul>

            <article id="module-people" aria-labelledby="module-people-title" className="mt-16 grid scroll-mt-24 items-center gap-12 lg:grid-cols-2 lg:gap-16">
              <div>
                <h3 id="module-people-title" className="font-display text-heading text-primary-900">
                  Everyone who helps, with their own link.
                </h3>
                <p className="mt-4 text-lg text-ink-500">
                  Add family, home aides, the day program and care managers. Nobody needs an account or an app: each person opens a private link.
                </p>
                <Points items={PEOPLE_POINTS} />
              </div>
              <AppPreview screen="people" />
            </article>

            <article id="module-calendar" aria-labelledby="module-calendar-title" className="mt-24 grid scroll-mt-24 items-center gap-12 lg:grid-cols-2 lg:gap-16">
              <div className="lg:order-2">
                <h3 id="module-calendar-title" className="font-display text-heading text-primary-900">
                  Every appointment, and who is taking them.
                </h3>
                <p className="mt-4 text-lg text-ink-500">
                  One calendar the whole circle can see. Nobody has to ask twice what time the cardiology visit is, or who is driving.
                </p>
                <Points items={CALENDAR_POINTS} />
              </div>
              <AppPreview screen="calendar" className="lg:order-1" />
            </article>

            <article id="module-tasks" aria-labelledby="module-tasks-title" className="mt-24 grid scroll-mt-24 items-center gap-12 lg:grid-cols-2 lg:gap-16">
              <div>
                <h3 id="module-tasks-title" className="font-display text-heading text-primary-900">
                  Who is doing what, and by when.
                </h3>
                <p className="mt-4 text-lg text-ink-500">
                  Write it down once. The person who has it sees it on their own link, and you see it get done.
                </p>
                <Points items={TODO_POINTS} />
              </div>
              <AppPreview screen="todos" />
            </article>

            <article id="module-medications" aria-labelledby="module-medications-title" className="mt-24 grid scroll-mt-24 items-center gap-12 lg:grid-cols-2 lg:gap-16">
              <div className="lg:order-2">
                <h3 id="module-medications-title" className="font-display text-heading text-primary-900">
                  Every pill, as of today.
                </h3>
                <p className="mt-4 text-lg text-ink-500">
                  You keep the list. Everyone you allow sees the same one, so the aide and the day program never work from an old paper copy.
                </p>
                <Points items={MEDICATION_POINTS} />
              </div>
              <AppPreview screen="medications" className="lg:order-1" />
            </article>

            <article id="module-summary" aria-labelledby="module-summary-title" className="mt-24 grid scroll-mt-24 items-center gap-12 lg:grid-cols-2 lg:gap-16">
              <div>
                <h3 id="module-summary-title" className="font-display text-heading text-primary-900">
                  What to know in a hurry.
                </h3>
                <p className="mt-4 text-lg text-ink-500">
                  Write it once: allergies, doctors, the pharmacy, emergency contacts and where the power of attorney is kept. Everyone you
                  allow sees the same page, in your words.
                </p>
                <Points items={SUMMARY_POINTS} />
              </div>
              <AppPreview screen="summary" />
            </article>
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
              {STEPS.filter((step) => !step.needs || ready(step.needs)).map(({ title, body }, index) => (
                <li key={title}>
                  <p className="font-display text-numeral leading-none text-primary-700">{index + 1}</p>
                  <h3 className="mt-4 text-item font-bold text-ink-900">{title}</h3>
                  <p className="mt-2 text-ink-500">{body}</p>
                </li>
              ))}
            </ol>
            <div className="mt-12 flex flex-col gap-3 sm:flex-row sm:items-center">
              <ButtonLink href={START_HREF} variant="primary" className="min-h-14 px-6 text-cta">
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
                  <h3 className="text-item font-bold text-ink-900">{title}</h3>
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
              <Eyebrow>Why I started All Hands Care</Eyebrow>
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
              <blockquote id="founder-title" className="font-display text-section leading-[1.35] text-primary-900 sm:text-page">
                &ldquo;After five years working with Medicaid billing for an adult day health center, I&apos;ve seen how many different people
                are involved in supporting aging adults. All Hands Care started with a simple question: what if the important information from a
                medical appointment reached everyone helping with care, without families having to explain it over and over?&rdquo;
              </blockquote>
            </figure>
          </div>
        </section>

        {/* Closing */}
        <section aria-labelledby="cta-title" className="bg-surface-50 px-4 py-16 sm:px-6 sm:py-20">
          <div className="mx-auto max-w-[1120px] rounded-3xl border border-border-200 bg-white px-6 py-14 text-center sm:px-12 sm:py-20">
            <h2 id="cta-title" className="font-display mx-auto max-w-2xl text-closing text-primary-900 sm:text-closing-lg">
              Start a care page for someone you look after.
            </h2>
            <p className="mt-4 text-lg text-ink-500">Free. Sign in with Google. Helpers never need an account.</p>
            <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
              <ButtonLink href={START_HREF} variant="primary" className="min-h-14 px-6 text-cta">
                Start a care circle <ArrowRight size={20} aria-hidden="true" />
              </ButtonLink>
              <StartSample variant="secondary" label="Try a sample visit" className="min-h-14 px-6 text-cta" />
            </div>
          </div>
        </section>
      </main>
    </PageShell>
  );
}
