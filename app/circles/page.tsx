import { ArrowRight, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CircleShell } from "@/components/circles/Shell";
import { Avatar } from "@/components/ui/Avatar";
import { getActor } from "@/lib/auth";
import { listCircles, type CircleListItem } from "@/services/circles";

export const metadata: Metadata = { title: "Your care circles", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * Home for everyone who signs in: the circles they run and the circles they help in (a link they
 * saved to their account). Someone who only helps is not shown the caregiver's start tile as if
 * they ran anything, but can still start a circle of their own.
 */
export default async function CirclesPage() {
  const actor = await getActor();
  if (!actor || actor.kind !== "caregiver") redirect("/login?next=/circles");
  const circles = await listCircles(actor);
  const run = circles.filter((circle) => circle.kind === "run");
  const help = circles.filter((circle) => circle.kind === "help");
  const onlyHelps = help.length > 0 && run.length === 0;
  return (
    <CircleShell signedIn circles={circles}>
      <p className="text-eyebrow font-bold tracking-[0.14em] text-primary-700 uppercase">Your care circles</p>
      <h1 className="font-display mt-2 text-heading text-primary-900 sm:text-heading-lg">{onlyHelps ? "The people you help" : "Who are you looking after?"}</h1>
      <p className="mt-3 max-w-2xl text-ink-500">A care circle is one shared page for one person, and the people who help them.</p>

      {!onlyHelps ? (
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {run.map((circle) => (
            <li key={circle.id}>
              <CircleCard circle={circle} />
            </li>
          ))}
          <li>
            <Link
              href="/circles/new"
              className="flex h-full min-h-32 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border-200 p-5 text-center font-semibold text-primary-700 hover:border-primary-700/50 hover:bg-surface-50"
            >
              <Plus size={24} aria-hidden="true" />
              Start a care circle
            </Link>
          </li>
        </ul>
      ) : null}

      {help.length ? (
        <section aria-labelledby="helping-title" className="mt-10">
          {!onlyHelps ? (
            <h2 id="helping-title" className="font-display text-section text-primary-900">
              Circles you help with
            </h2>
          ) : (
            <h2 id="helping-title" className="sr-only">
              Circles you help with
            </h2>
          )}
          <ul className={`grid gap-4 sm:grid-cols-2 lg:grid-cols-3 ${onlyHelps ? "mt-8" : "mt-4"}`}>
            {help.map((circle) => (
              <li key={circle.id}>
                <CircleCard circle={circle} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {onlyHelps ? (
        <p className="mt-10 text-ink-500">
          Looking after someone yourself?{" "}
          <Link href="/circles/new" className="font-semibold text-primary-700 underline decoration-primary-700/30 underline-offset-4 hover:text-primary-900">
            Start your own care circle
          </Link>
        </p>
      ) : null}
    </CircleShell>
  );
}

function CircleCard({ circle }: { circle: CircleListItem }) {
  return (
    <Link href={`/circles/${circle.id}`} className="group flex h-full min-h-32 flex-col justify-between rounded-2xl border border-border-200 bg-white p-5 hover:border-primary-700">
      <span className="flex items-center gap-3">
        <Avatar name={circle.personName} size="lg" />
        <span className="font-display text-section leading-tight text-primary-900">{circle.personName}</span>
      </span>
      <span className="mt-4 flex items-center justify-between text-sm text-ink-500">
        {circle.kind === "run" ? "You run this circle" : `You help here · ${circle.roleLabel ?? "Helper"}`}
        <ArrowRight size={18} className="text-primary-700 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
      </span>
    </Link>
  );
}
