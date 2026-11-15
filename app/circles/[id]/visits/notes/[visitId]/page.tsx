import { Images } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PageHead } from "@/components/circles/PageHead";
import { DeleteVisit, EditVisit } from "@/components/visits/EditVisit";
import { VisitNoteLists } from "@/components/visits/VisitNotes";
import { getActor } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { hasNotes, visitLabel } from "@/lib/schema/visits";
import { getVisit } from "@/services/visits";

export const metadata: Metadata = { title: "Visit notes", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * One visit's notes: the short summary, what to watch for, good to know and questions for the next
 * visit. A person with a link sees what their role allows; the caregiver can fix or delete the
 * notes and open the photos they kept.
 */
export default async function VisitNotesPage({ params }: { params: Promise<{ id: string; visitId: string }> }) {
  const { id, visitId } = await params;
  const actor = await getActor(id);
  if (!actor) redirect(`/login?next=/circles/${id}/visits/notes/${visitId}`);
  const visit = /^[0-9a-f-]{36}$/i.test(visitId) ? await getVisit(actor, id, visitId) : null;
  if (!visit) notFound();
  const canEdit = actor.kind === "caregiver" && can(actor, "visits:edit", { circleId: id });
  const who = [visit.provider, visit.specialty].filter(Boolean).join(" · ");
  return (
    <>
      <PageHead
        back={{ href: `/circles/${id}/visits`, label: "Visits" }}
        title={visitLabel(visit)}
        subtitle={who || undefined}
        help={
          canEdit
            ? "What this visit's summary said besides medicines and reminders. Family and care managers see all of it; home aides and day programs see what to watch for and good to know."
            : "What this visit's summary said, as the caregiver saved it."
        }
      />
      <div className="space-y-5 rounded-lg border border-border-200 bg-white p-4 sm:p-5">
        {visit.summary || visit.reason ? (
          <section aria-labelledby="visit-summary-title">
            <h2 id="visit-summary-title" className="text-[12px] font-bold tracking-[0.08em] text-ink-500 uppercase">
              Summary
            </h2>
            {visit.reason ? <p className="mt-1.5 text-[14px] text-ink-500">Reason for the visit: {visit.reason}</p> : null}
            {visit.summary ? <p className="mt-1.5 text-[16px] text-ink-900">{visit.summary}</p> : null}
          </section>
        ) : null}
        <VisitNoteLists visit={visit} />
        {hasNotes(visit) ? null : <p className="text-[15px] text-ink-500">No notes were kept with this visit.</p>}
      </div>
      {visit.documentId ? (
        <Link
          href={`/circles/${id}/visits/${visit.documentId}`}
          className="mt-4 flex min-h-14 items-center gap-3 rounded-lg border border-border-200 bg-white px-4 text-[15px] font-semibold text-primary-700 hover:bg-sky-100/50"
        >
          <Images className="size-6 shrink-0" aria-hidden="true" /> See the photos you kept from this visit
        </Link>
      ) : null}
      {canEdit ? (
        <div className="mt-6 flex flex-wrap items-start gap-2">
          <EditVisit circleId={id} visit={visit} />
          <DeleteVisit circleId={id} id={visit.id} />
        </div>
      ) : null}
      <p className="mt-6 text-[13px] text-ink-500">Not medical advice. These are the clinic&apos;s words as the caregiver saved them.</p>
    </>
  );
}
