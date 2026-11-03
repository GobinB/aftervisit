import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CircleForm } from "@/components/circles/CircleForm";
import { CircleShell } from "@/components/circles/Shell";
import { getActor } from "@/lib/auth";

export const metadata: Metadata = { title: "Start a care circle", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function NewCirclePage() {
  const actor = await getActor();
  if (!actor || actor.kind !== "caregiver") redirect("/login?next=/circles/new");
  return (
    <CircleShell signedIn narrow>
      <p className="text-eyebrow font-bold tracking-[0.14em] text-primary-700 uppercase">Start a care circle</p>
      <p className="mt-2 mb-8 text-ink-500">
        One shared page for the person you look after. AfterVisit stores your words as you type them and does not interpret them.
      </p>
      <CircleForm />
    </CircleShell>
  );
}
