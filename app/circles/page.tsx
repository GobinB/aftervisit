import { ArrowRight, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CircleShell } from "@/components/circles/Shell";
import { InstallApp } from "@/components/pwa/InstallApp";
import { RestoreKeys } from "@/components/circles/RestoreKeys";
import { Avatar } from "@/components/ui/Avatar";
import { getActor } from "@/lib/auth";
import { listCircles, listOwnCircleKeys } from "@/services/circles";

export const metadata: Metadata = { title: "Your care circles", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function CirclesPage() {
  const actor = await getActor();
  if (!actor || actor.kind !== "caregiver") redirect("/login?next=/circles");
  const circles = await listCircles(actor);
  const keys = await listOwnCircleKeys(actor);
  return (
    <CircleShell signedIn>
      <p className="text-eyebrow font-bold tracking-[0.14em] text-primary-700 uppercase">Your care circles</p>
      <h1 className="font-display mt-2 text-heading text-primary-900 sm:text-heading-lg">Who are you looking after?</h1>
      <p className="mt-3 max-w-2xl text-ink-500">A care circle is one shared page for one person, and the people who help them.</p>
      <RestoreKeys circles={keys} />
      <InstallApp />
      <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {circles.map((circle) => {
          const role = keys.find((key) => key.circleId === circle.id)?.role === "owner" ? "You started this circle" : "You help run this circle";
          return (
            <li key={circle.id}>
              <Link
                href={`/circles/${circle.id}`}
                className="group flex h-full min-h-32 flex-col justify-between rounded-2xl border border-border-200 bg-white p-5 hover:border-primary-700"
              >
                <span className="flex items-center gap-3">
                  <Avatar name={circle.personName} size="lg" />
                  <span className="font-display text-section leading-tight text-primary-900">{circle.personName}</span>
                </span>
                <span className="mt-4 flex items-center justify-between text-sm text-ink-500">
                  {role}
                  <ArrowRight size={18} className="text-primary-700 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                </span>
              </Link>
            </li>
          );
        })}
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
    </CircleShell>
  );
}
