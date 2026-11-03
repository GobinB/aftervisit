import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { CircleFrame, circleTabs, roleLine } from "@/components/circles/CircleFrame";
import { CircleShell } from "@/components/circles/Shell";
import { SummaryView } from "@/components/circles/SummaryView";
import { getActor } from "@/lib/auth";
import { getCircle } from "@/services/circles";

export const metadata: Metadata = { title: "Care summary", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function SummaryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await getActor(id);
  if (!actor) redirect(`/login?next=/circles/${id}/summary`);
  const content = await getCircle(actor, id);
  if (!content) notFound();
  return (
    <CircleShell signedIn={actor.kind === "caregiver"}>
      <CircleFrame personName={content.person_name} subtitle={roleLine(actor)} tabs={circleTabs(actor, id)} active="summary">
        <p className="mb-8 max-w-2xl text-ink-500">What to know in a hurry, as the caregiver wrote it. AfterVisit stores these words and does not interpret them.</p>
        <SummaryView content={content} />
      </CircleFrame>
    </CircleShell>
  );
}
