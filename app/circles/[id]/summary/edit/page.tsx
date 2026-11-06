import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PageHead } from "@/components/circles/PageHead";
import { SummaryEditor } from "@/components/circles/SummaryEditor";
import { PART_TITLES, SUMMARY_PARTS, type SummaryPart } from "@/lib/summary-parts";
import { getActor } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getCircle } from "@/services/circles";

export const metadata: Metadata = { title: "Care summary", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** Fill in one part of the care summary (from a card on Today), or all of it (from the Care summary page). */
export default async function EditSummaryPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ part?: string }> }) {
  const { id } = await params;
  const { part: raw } = await searchParams;
  const actor = await getActor(id);
  if (!actor) redirect(`/login?next=/circles/${id}/summary/edit`);
  if (actor.kind !== "caregiver" || !can(actor, "summary:edit", { circleId: id })) notFound();
  const content = await getCircle(actor, id);
  if (!content) notFound();
  const part = SUMMARY_PARTS.includes(raw as SummaryPart) ? (raw as SummaryPart) : null;
  const back = part ? { href: `/circles/${id}`, label: "Today" } : { href: `/circles/${id}/summary`, label: "Care summary" };
  return (
    <>
      <PageHead
        back={back}
        title={part ? PART_TITLES[part] : "Edit care summary"}
        subtitle={`For ${content.person_name}. Leave out anything you don't want to record.`}
        help="Tap a suggestion or type. Everything here is optional, and you can change it any time."
      />
      <SummaryEditor circleId={id} content={content} part={part} />
    </>
  );
}
