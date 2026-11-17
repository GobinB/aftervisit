import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PageHead } from "@/components/circles/PageHead";
import { SummaryEditor } from "@/components/circles/SummaryEditor";
import { PART_TITLES, SUMMARY_PARTS, SUMMARY_RETURNS, type SummaryPart, type SummaryReturn } from "@/lib/summary-parts";
import { getActor } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getCircle } from "@/services/circles";

export const metadata: Metadata = { title: "Care summary", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * Fill in one part of the care summary (from a card on Today, or from the Emergency page with
 * `from=emergency`), or all of it (from the Care summary page). Back and Save return to where it was opened.
 */
export default async function EditSummaryPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ part?: string; from?: string }> }) {
  const { id } = await params;
  const { part: raw, from: rawFrom } = await searchParams;
  const part = SUMMARY_PARTS.includes(raw as SummaryPart) ? (raw as SummaryPart) : null;
  const fromKey = part && Object.hasOwn(SUMMARY_RETURNS, rawFrom ?? "") ? (rawFrom as SummaryReturn) : null;
  const actor = await getActor(id);
  if (!actor) {
    // Back to this same part after signing in, with Back still going where it was opened from.
    const query = new URLSearchParams(part ? { part, ...(fromKey ? { from: fromKey } : {}) } : {}).toString();
    redirect(`/login?next=${encodeURIComponent(`/circles/${id}/summary/edit${query ? `?${query}` : ""}`)}`);
  }
  if (actor.kind !== "caregiver" || !can(actor, "summary:edit", { circleId: id })) notFound();
  const content = await getCircle(actor, id);
  if (!content) notFound();
  const from = fromKey ? SUMMARY_RETURNS[fromKey] : null;
  const back = from
    ? { href: `/circles/${id}${from.path}`, label: from.label }
    : part
      ? { href: `/circles/${id}`, label: "Today" }
      : { href: `/circles/${id}/summary`, label: "Care summary" };
  return (
    <>
      <PageHead
        back={back}
        title={part ? PART_TITLES[part] : "Edit care summary"}
        subtitle={`For ${content.person_name}. Leave out anything you don't want to record.`}
        help="Tap a suggestion or type. Everything here is optional, and you can change it any time."
      />
      <SummaryEditor circleId={id} content={content} part={part} done={back.href} />
    </>
  );
}
