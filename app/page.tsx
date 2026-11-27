import { ArrowRight, CalendarDays, Check, ChevronDown, EllipsisVertical, FileText, ListChecks, Lock, Pill, Share, SquarePlus, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ButtonLink } from "@/components/Button";
import { HowACircleWorks } from "@/components/home/HowACircleWorks";
import { PhonePreview } from "@/components/home/PhonePreview";
import { JsonLd } from "@/components/JsonLd";
import { PageShell } from "@/components/PageShell";
import { InstallApp } from "@/components/pwa/InstallApp";
import { StartSample } from "@/components/StartSample";
import { faqPage, pageSeo } from "@/lib/seo";
import { ASSEMBLY_CODE, CAREGIVING_FACTS, CAREGIVING_SOURCE } from "@/lib/site";

export const metadata: Metadata = pageSeo("/");

/** Where a caregiver starts. /circles/new sends a signed-out visitor to Google sign-in first. */
const START_HREF = "/circles/new";

const FEATURES = [
  { icon: CalendarDays, title: "Calendar", body: "Appointments, and who is taking them." },
  { icon: ListChecks, title: "Reminders", body: "Ask for help. Someone taps “I’ll do it.”" },
  { icon: Pill, title: "Medications", body: "Today’s list, with every change dated." },
  { icon: FileText, title: "Visit summaries", body: "Turn the after-visit summary into updates." },
];

const STEPS = [
  { title: "Start a circle", body: "Sign in with Google and add the person you look after." },
  { title: "Add the people who help", body: "Family, aides and the day program each get their own link. No account needed; anyone can sign in to keep all their circles in one place." },
  { title: "Keep it current", body: "After each visit, update it once. Everyone sees the same page." },
];

const PROMISES = [
  "Each person sees only what you choose.",
  "No ads. Your information is never sold.",
  "Turn off anyone’s link at any time.",
];

/** Answers must match the privacy policy and terms; change them together. */
const FAQ = [
  {
    q: "Does everyone need an account?",
    a: "No. The caregiver who starts the circle signs in with Google. Everyone else opens their own private link, with no password and nothing to install. Someone who helps in more than one circle, like a care manager or a family member looking after both parents, can sign in with Google to keep every circle in one place. After that their link opens only for them.",
  },
  {
    q: "What does it cost?",
    a: "Nothing. All Hands Care is free, with no ads, and your information is never sold. It is a project of Assembly Code, a nonprofit.",
  },
  {
    q: "What can a home aide or day program see?",
    a: "Only what you choose. On “Everything”, a home aide or day program sees the calendar, medications, the care summary, the reminders given to them (not everyone’s) and, from visit notes, what to watch for and good to know. Pick “Calendar and reminders only” to show less, or choose each part. You can change it for each person at any time, on the same link.",
  },
  {
    q: "What if a link goes to the wrong person?",
    a: "Open People and make a new link for that person. The old one stops working at once. You can also add a PIN, so a link alone is not enough.",
  },
  {
    q: "Does it send reminders by text?",
    a: "No. It does not send texts or alerts. You can add the circle's calendar link to your phone's calendar, so appointments and reminders show up there.",
  },
  {
    q: "Is it covered by HIPAA?",
    a: "HIPAA covers doctors, hospitals and health plans, not tools families use on their own. We still treat what you keep here as sensitive health information. Our privacy policy explains how.",
  },
  {
    q: "Does it give medical advice?",
    a: "No. It organizes what the clinician wrote. Always follow what the doctor, nurse or pharmacist tells you. In an emergency, call 911.",
  },
  {
    q: "Can I stop using it?",
    a: "Yes, any time. Delete the circle from its Settings: every link stops working at once, and everything is erased for good after 30 days.",
  },
];

const INSTALL = [
  {
    phone: "iPhone and iPad",
    steps: [
      { icon: Share, text: "Tap Share: at the bottom on iPhone (tap ••• first if you don't see it), at the top on iPad." },
      { icon: SquarePlus, text: "Tap Add to Home Screen, then Add." },
    ],
  },
  {
    phone: "Android",
    steps: [
      { icon: EllipsisVertical, text: "Open this site in Chrome and tap the menu." },
      { icon: SquarePlus, text: "Tap Install app or Add to Home screen." },
    ],
  },
];

export default function HomePage() {
  return (
    <PageShell>
      <JsonLd data={faqPage("/", FAQ)} />
      <main id="main" className="flex-1 overflow-x-clip">
        {/* Hero: navy, with the app itself on a phone */}
        <section className="bg-primary-900 text-white">
          <div className="mx-auto grid max-w-[1120px] items-center gap-10 px-4 pt-12 pb-14 sm:px-6 sm:pt-16 lg:grid-cols-[1.1fr_0.9fr] lg:gap-12 lg:pt-20 lg:pb-20">
            <div className="min-w-0">
              <p className="text-[12px] font-semibold tracking-[0.14em] text-[#F6B7AA] uppercase">Free · Open source</p>
              <h1 className="font-display mt-4 text-[2.4rem] leading-[1.08] sm:text-[3.4rem]">Everyone who helps, on one page.</h1>
              <p className="mt-5 max-w-[34rem] text-[1.1rem] leading-relaxed text-white/80">
                One place for the calendar, reminders and medications of the person you look after. Family and aides each open their own link.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <ButtonLink href={START_HREF} variant="light" className="min-h-13 px-6">
                  Start a care circle <ArrowRight size={18} aria-hidden="true" />
                </ButtonLink>
                <StartSample variant="navy" label="Try a sample visit" className="min-h-13 px-6" />
              </div>
              <p className="mt-6 text-[15px] text-white/75">
                A project of{" "}
                <a href={ASSEMBLY_CODE.url} className="font-semibold text-white underline underline-offset-4" target="_blank" rel="noreferrer">
                  {ASSEMBLY_CODE.name}
                </a>
                , a nonprofit.
              </p>
            </div>
            <PhonePreview className="lg:mr-0 lg:ml-auto" />
          </div>
        </section>

        {/* Add to the home screen, early, so people know it works like an app */}
        <section aria-labelledby="install-title" className="bg-[#FCEDEA]">
          <div className="mx-auto max-w-[1120px] px-4 py-12 sm:px-6 sm:py-14">
            <div className="max-w-2xl">
              <h2 id="install-title" className="font-display text-[1.9rem] leading-tight text-primary-900">
                Put it on your phone like an app.
              </h2>
              <p className="mt-2 text-ink-500">Nothing to download from an app store. It also works in any web browser, on a computer too.</p>
            </div>
            <div className="mt-6 max-w-xl">
              <InstallApp />
            </div>
            <div className="mt-7 grid gap-4 md:grid-cols-2">
              {INSTALL.map(({ phone, steps }) => (
                <div key={phone} className="rounded-xl bg-white p-5">
                  <p className="text-[12px] font-semibold tracking-[0.12em] text-ink-500 uppercase">{phone}</p>
                  <ol className="mt-3 space-y-3">
                    {steps.map(({ icon: Icon, text }, index) => (
                      <li key={text} className="flex items-center gap-3">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#FCEDEA] font-semibold text-attn-ink">{index + 1}</span>
                        <Icon className="size-5 shrink-0 text-primary-700" aria-hidden="true" />
                        <span className="text-ink-900">{text}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* What it does */}
        <section aria-labelledby="features-title" className="bg-white">
          <div className="mx-auto max-w-[1120px] px-4 py-14 sm:px-6 sm:py-20">
            <h2 id="features-title" className="font-display max-w-xl text-[1.9rem] leading-tight text-primary-900">
              The care, in one shared place.
            </h2>
            <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {FEATURES.map(({ icon: Icon, title, body }) => (
                <li key={title} className="rounded-xl border border-border-200 bg-paper-100/50 p-5">
                  <span className="flex size-11 items-center justify-center rounded-full bg-sky-100 text-primary-700">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <h3 className="mt-4 text-[1.05rem] font-semibold text-ink-900">{title}</h3>
                  <p className="mt-1 text-ink-500">{body}</p>
                </li>
              ))}
            </ul>
            <p className="mt-6 flex items-center gap-2 text-ink-500">
              <Users className="size-5 shrink-0 text-primary-700" aria-hidden="true" />
              One caregiver runs each circle. Everyone else opens their own private link, no account needed, and can sign in to keep all their circles in one place.
            </p>
          </div>
        </section>

        {/* Why: the problem, with numbers a reader can check */}
        <section aria-labelledby="why-title" className="bg-paper-100">
          <div className="mx-auto max-w-[1120px] px-4 py-14 sm:px-6 sm:py-20">
            <h2 id="why-title" className="font-display max-w-2xl text-[1.9rem] leading-tight text-primary-900">
              One person shouldn’t have to be the switchboard.
            </h2>
            <p className="mt-3 max-w-2xl text-ink-500">
              After every visit, someone passes the news along by phone and text, one person at a time. Millions of families do this every
              week.
            </p>
            <ul className="mt-8 grid gap-4 md:grid-cols-3">
              {CAREGIVING_FACTS.map(({ figure, body }) => (
                <li key={figure} className="rounded-xl bg-white p-5">
                  <p className="font-display text-[2.2rem] leading-none text-primary-900">{figure}</p>
                  <p className="mt-2 text-ink-900">{body}</p>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-[14px] text-ink-500">
              Source:{" "}
              <a className="text-primary-700 underline underline-offset-2" href={CAREGIVING_SOURCE.url} target="_blank" rel="noreferrer">
                {CAREGIVING_SOURCE.title}
              </a>
              .{" "}
              <Link className="text-primary-700 underline underline-offset-2" href="/about">
                Why we built All Hands Care
              </Link>
            </p>
          </div>
        </section>

        {/* How it works */}
        <section id="how" aria-labelledby="how-title" className="scroll-mt-20 bg-white">
          <div className="mx-auto max-w-[1120px] px-4 py-14 sm:px-6 sm:py-20">
            <h2 id="how-title" className="font-display text-[1.9rem] leading-tight text-primary-900">
              How it works
            </h2>
            <ol className="mt-8 grid gap-4 md:grid-cols-3">
              {STEPS.map(({ title, body }, index) => (
                <li key={title} className="rounded-xl border border-border-200 bg-paper-100/50 p-5">
                  <span className="font-display text-[2rem] leading-none text-[#E5644E]">{index + 1}</span>
                  <h3 className="mt-3 text-[1.05rem] font-semibold text-ink-900">{title}</h3>
                  <p className="mt-1 text-ink-500">{body}</p>
                </li>
              ))}
            </ol>
            <div className="mt-6">
              <HowACircleWorks />
            </div>
          </div>
        </section>

        {/* Privacy */}
        <section aria-labelledby="privacy-title" className="bg-sidebar text-white">
          <div className="mx-auto grid max-w-[1120px] gap-8 px-4 py-14 sm:px-6 sm:py-16 md:grid-cols-[1fr_1.2fr] md:items-center">
            <div>
              <Lock className="size-8 text-[#F6B7AA]" aria-hidden="true" />
              <h2 id="privacy-title" className="font-display mt-3 text-[1.9rem] leading-tight">
                Private by design.
              </h2>
              <Link href="/privacy" className="mt-3 inline-flex items-center gap-1.5 font-semibold text-white underline-offset-4 hover:underline">
                Our privacy promise <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
            <ul className="space-y-3">
              {PROMISES.map((promise) => (
                <li key={promise} className="flex items-start gap-3 text-[1.05rem] text-white/90">
                  <Check className="mt-1 size-5 shrink-0 text-[#F6B7AA]" strokeWidth={2.5} aria-hidden="true" />
                  {promise}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Questions caregivers ask */}
        <section id="questions" aria-labelledby="faq-title" className="scroll-mt-20 bg-white">
          <div className="mx-auto max-w-[1120px] px-4 py-14 sm:px-6 sm:py-20">
            <h2 id="faq-title" className="font-display text-[1.9rem] leading-tight text-primary-900">
              Questions caregivers ask
            </h2>
            <div className="mt-8 divide-y divide-border-200 border-y border-border-200">
              {FAQ.map(({ q, a }) => (
                <details key={q} className="group">
                  <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-3 text-[1.05rem] font-semibold text-ink-900 [&::-webkit-details-marker]:hidden">
                    {q}
                    <ChevronDown className="size-5 shrink-0 text-primary-700 transition-transform group-open:rotate-180" aria-hidden="true" />
                  </summary>
                  <p className="max-w-3xl pb-5 text-ink-500">{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* First families: an honest ask, like a pilot sign-up */}
        <section aria-labelledby="try-title" className="bg-[#FCEDEA]">
          <div className="mx-auto grid max-w-[1120px] gap-6 px-4 py-12 sm:px-6 sm:py-14 md:grid-cols-[1.3fr_1fr] md:items-center">
            <div>
              <h2 id="try-title" className="font-display text-[1.9rem] leading-tight text-primary-900">
                We’re trying it with our first families.
              </h2>
              <p className="mt-2 text-ink-900">
                Share the care of a parent with family, an aide or a day program? We’ll set it up with you in about 15 minutes and check in
                after a few days. Tell us honestly what works and what doesn’t.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row md:flex-col md:items-start">
              <ButtonLink href="/contact" className="min-h-13 px-6">
                Try it with your family <ArrowRight size={18} aria-hidden="true" />
              </ButtonLink>
              <Link href="/care-teams" className="inline-flex min-h-11 items-center font-semibold text-primary-700 underline underline-offset-4">
                For agencies and day programs
              </Link>
            </div>
          </div>
        </section>

        {/* Closing call to action */}
        <section aria-labelledby="start-title" className="bg-white">
          <div className="mx-auto max-w-[1120px] px-4 py-14 text-center sm:px-6 sm:py-20">
            <h2 id="start-title" className="font-display text-[2rem] leading-tight text-primary-900 sm:text-[2.4rem]">
              Start your care circle. It’s free.
            </h2>
            <ButtonLink href={START_HREF} className="mt-7 min-h-13 px-7">
              Start a care circle <ArrowRight size={18} aria-hidden="true" />
            </ButtonLink>
          </div>
        </section>
      </main>
    </PageShell>
  );
}
