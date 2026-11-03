import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CircleForm } from "@/components/circles/CircleForm";
import { CircleShell } from "@/components/circles/Shell";
import { getActor } from "@/lib/auth";

export const metadata: Metadata = { title: "New circle", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function NewCirclePage() {
  const actor = await getActor();
  if (!actor || actor.kind !== "caregiver") redirect("/login?next=/circles/new");
  return (
    <CircleShell>
      <h1 className="font-display text-page text-primary-900">New circle</h1>
      <p className="mt-2 mb-6 text-ink-500">Record what you want the circle to hold. AfterVisit stores your words and does not interpret them.</p>
      <CircleForm />
    </CircleShell>
  );
}
