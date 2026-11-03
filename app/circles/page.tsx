import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ButtonLink } from "@/components/ui/Button";
import { CircleShell } from "@/components/circles/Shell";
import { RestoreKeys } from "@/components/circles/RestoreKeys";
import { getActor } from "@/lib/auth";
import { listCircles, listOwnCircleKeys } from "@/services/circles";

export const metadata: Metadata = { title: "Circles", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function CirclesPage() {
  const actor = await getActor();
  if (!actor || actor.kind !== "caregiver") redirect("/login?next=/circles");
  const circles = await listCircles(actor);
  const keys = await listOwnCircleKeys(actor);
  return (
    <CircleShell signedIn>
      <h1 className="font-display text-page text-primary-900">Circles</h1>
      <p className="mt-2 text-ink-500">A circle is the people who help one person. You choose what is saved.</p>
      <RestoreKeys circles={keys} />
      {circles.length ? (
        <ul className="mt-6 space-y-3">
          {circles.map((circle) => (
            <li key={circle.id}>
              <Link href={`/circles/${circle.id}`} className="block min-h-12 rounded-2xl border border-border-200 bg-white px-4 py-3 font-semibold text-ink-900">
                {circle.personName}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-6 text-ink-500">No circle yet.</p>
      )}
      <ButtonLink href="/circles/new" className="mt-6 w-full">
        Start a care circle
      </ButtonLink>
    </CircleShell>
  );
}
