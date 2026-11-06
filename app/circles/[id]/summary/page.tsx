import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { CircleFrame, circleTabs, roleLine } from "@/components/circles/CircleFrame";
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
    <>
      <CircleFrame personName={content.person_name} subtitle={roleLine(actor)} tabs={circleTabs(actor, id)} help="The facts to have in a hurry: allergies, conditions and who to call. Tap Edit to change them." active="summary">
        <div className="rounded-2xl border border-border-200 bg-white p-5 sm:p-6">
          <p className="mb-8 max-w-2xl text-ink-500">What to know in a hurry, as the caregiver wrote it. All Hands Care stores these words and does not interpret them.</p>
          <SummaryView content={content} />
        </div>
      </CircleFrame>
    </>
  );
}
