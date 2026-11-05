import { Check } from "lucide-react";
import Link from "next/link";
import type { PersonView } from "@/lib/schema/circles";

/** First steps for the owner, shown on Today until every step is done. */
export function GettingStarted({ circleId, people }: { circleId: string; people: PersonView[] }) {
  const helpers = people.filter((person) => person.kind === "member" && !person.revokedAt);
  const steps = [
    { title: "Start the circle", done: true, href: null },
    { title: "Add the first person who helps", done: helpers.length > 0, href: `/circles/${circleId}/members` },
    { title: "Someone opens their link", done: helpers.some((person) => person.lastSeenAt), href: `/circles/${circleId}/members` },
  ];
  if (steps.every((step) => step.done)) return null;
  const next = steps.find((step) => !step.done);
  return (
    <section aria-labelledby="start-title" className="rounded-lg border border-border-200 bg-white p-4">
      <h2 id="start-title" className="font-display text-[19px] text-primary-900">
        Getting started
      </h2>
      <ol className="mt-3 space-y-2.5 text-[14px]">
        {steps.map((step, index) => (
          <li key={step.title} className="flex items-center gap-3">
            <span
              className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                step.done ? "bg-ok text-white" : "bg-white text-ink-500 ring-1 ring-border-200"
              }`}
            >
              {step.done ? <Check size={16} strokeWidth={3} aria-hidden="true" /> : index + 1}
            </span>
            <span className={step.done ? "text-ink-500 line-through decoration-ink-500/40" : "font-semibold text-ink-900"}>
              {step.title}
              <span className="sr-only">{step.done ? " (done)" : " (not done)"}</span>
            </span>
          </li>
        ))}
      </ol>
      {next?.href ? (
        <Link href={next.href} className="mt-4 inline-flex h-9 items-center rounded-md bg-primary-700 px-3 text-[13px] font-semibold text-white hover:bg-primary-900">
          {next === steps[1] ? "Add a person" : "See who has opened their link"}
        </Link>
      ) : null}
    </section>
  );
}
