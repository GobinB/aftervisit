import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CircleForm } from "@/components/circles/CircleForm";
import { BackLink } from "@/components/circles/PageHead";
import { CircleShell } from "@/components/circles/Shell";
import { getActor } from "@/lib/auth";

export const metadata: Metadata = { title: "Start a care circle", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function NewCirclePage() {
  const actor = await getActor();
  if (!actor || actor.kind !== "caregiver") redirect("/login?next=/circles/new");
  return (
    <CircleShell signedIn narrow>
      <BackLink href="/circles" label="Your circles" />
      <div className="rounded-2xl border border-border-200 bg-white p-5 sm:p-8">
        <h1 className="font-display text-page text-primary-900">Start a care circle</h1>
        <p className="mt-2 mb-8 text-ink-500">
          One shared page for the person you look after. All Hands Care stores your words as you type them and does not interpret them.
        </p>
        <CircleForm />
      </div>
    </CircleShell>
  );
}
