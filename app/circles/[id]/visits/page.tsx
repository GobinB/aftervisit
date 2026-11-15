import { ChevronRight, FileText, Images, Stethoscope } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PageHead } from "@/components/circles/PageHead";
import { getActor } from "@/lib/auth";
import { documentTitle } from "@/lib/schema/documents";
import { visitLabel, type VisitView } from "@/lib/schema/visits";
import { listDocuments } from "@/services/documents";
import { listVisits } from "@/services/visits";

export const metadata: Metadata = { title: "Visits", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** "3 to watch for · 2 good to know · 1 question" */
function counts(visit: VisitView, photos: boolean): string {
  const parts = [
    visit.watchFor.length ? `${visit.watchFor.length} to watch for` : null,
    visit.goodToKnow.length ? `${visit.goodToKnow.length} good to know` : null,
    visit.questions?.length ? `${visit.questions.length} question${visit.questions.length === 1 ? "" : "s"}` : null,
    photos ? "photos kept" : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : "No notes";
}

/**
 * Every visit whose summary was added to the circle, newest first, with its notes. The caregiver
 * also sees the photos they chose to keep; nobody else does.
 */
export default async function VisitsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await getActor(id);
  if (!actor) redirect(`/login?next=/circles/${id}/visits`);
  const [visits, documents] = await Promise.all([listVisits(actor, id), listDocuments(actor, id)]);
  if (!visits && !documents) notFound();
  const withPhotos = new Set((documents ?? []).map((doc) => doc.visitId).filter(Boolean));
  // Photos kept before visit notes existed have no visit to sit under.
  const loose = (documents ?? []).filter((doc) => !doc.visitId || !(visits ?? []).some((visit) => visit.id === doc.visitId));
  const caregiver = actor.kind === "caregiver";
  return (
    <>
      <PageHead
        back={{ href: `/circles/${id}`, label: "Today" }}
        title="Visits"
        subtitle={caregiver ? "What each visit summary said, and the photos you kept." : "What each visit summary said."}
        help={
          caregiver
            ? "Each after-visit summary you added to the circle. Tap one to read its notes, fix them, or see the photos. Only you can see the photos."
            : "Each visit the caregiver added. Tap one to read what to watch for and what is good to know."
        }
      />
      {visits?.length ? (
        <ul className="divide-y divide-border-200 overflow-hidden rounded-lg border border-border-200 bg-white">
          {visits.map((visit) => (
            <li key={visit.id}>
              <Link href={`/circles/${id}/visits/notes/${visit.id}`} className="flex min-h-16 items-center gap-3 px-4 py-3 hover:bg-sky-100/50">
                <Stethoscope className="size-6 shrink-0 text-primary-700" aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[16px] font-semibold text-ink-900">{visitLabel(visit)}</span>
                  <span className="block text-[13px] text-ink-500">{counts(visit, withPhotos.has(visit.id))}</span>
                </span>
                <ChevronRight className="size-5 text-ink-500" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-lg border border-border-200 bg-white px-4 py-8 text-center text-[15px] text-ink-500">
          {caregiver ? "None yet. When you scan an after-visit summary, what it says is kept here." : "No visits have been added yet."}
        </p>
      )}
      {loose.length ? (
        <section aria-labelledby="loose-title" className="mt-6">
          <h2 id="loose-title" className="mb-2 text-[11px] font-semibold tracking-[0.12em] text-ink-500 uppercase">
            Saved photos
          </h2>
          <ul className="divide-y divide-border-200 overflow-hidden rounded-lg border border-border-200 bg-white">
            {loose.map((doc) => (
              <li key={doc.id}>
                <Link href={`/circles/${id}/visits/${doc.id}`} className="flex min-h-16 items-center gap-3 px-4 py-3 hover:bg-sky-100/50">
                  {doc.kind === "pdf" ? <FileText className="size-6 shrink-0 text-primary-700" aria-hidden="true" /> : <Images className="size-6 shrink-0 text-primary-700" aria-hidden="true" />}
                  <span className="min-w-0 flex-1 text-[16px] font-semibold text-ink-900">{documentTitle(doc)}</span>
                  <ChevronRight className="size-5 text-ink-500" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
