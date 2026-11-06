import { Images, Pencil } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CircleFrame, circleTabs, roleLine } from "@/components/circles/CircleFrame";
import { SummaryView } from "@/components/circles/SummaryView";
import { getActor } from "@/lib/auth";
import { getCircle } from "@/services/circles";
import { listDocuments } from "@/services/documents";
import { documentTitle } from "@/lib/schema/documents";

export const metadata: Metadata = { title: "Care summary", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function SummaryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await getActor(id);
  if (!actor) redirect(`/login?next=/circles/${id}/summary`);
  const [content, documents] = await Promise.all([getCircle(actor, id), listDocuments(actor, id, 20)]);
  if (!content) notFound();
  return (
    <>
      <CircleFrame personName={content.person_name} subtitle={roleLine(actor)} tabs={circleTabs(actor, id)} help="The facts to have in a hurry: allergies, doctors and who to call. Tap Edit care summary to change them." active="summary">
        <div className="rounded-2xl border border-border-200 bg-white p-5 sm:p-6">
          <p className="mb-8 max-w-2xl text-ink-500">What to know in a hurry, as the caregiver wrote it. All Hands Care stores these words and does not interpret them.</p>
          <SummaryView content={content} />
          {actor.kind === "caregiver" ? (
            <Link
              href={`/circles/${id}/summary/edit`}
              className="no-print mt-8 inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary-700 px-4 text-[15px] font-semibold text-white hover:bg-primary-900"
            >
              <Pencil className="size-4" aria-hidden="true" /> Edit care summary
            </Link>
          ) : null}
          {documents ? (
            <section aria-labelledby="saved-title" className="no-print mt-8 border-t border-border-200 pt-6">
              <h2 id="saved-title" className="font-display text-[20px] text-primary-900">
                Saved visit summaries
              </h2>
              {documents.length ? (
                <ul className="mt-2 divide-y divide-border-200">
                  {documents.slice(0, 5).map((doc) => (
                    <li key={doc.id}>
                      <Link href={`/circles/${id}/visits/${doc.id}`} className="flex min-h-12 items-center gap-2 py-2 text-[15px] font-semibold text-primary-700 hover:text-primary-900">
                        <Images className="size-5 shrink-0" aria-hidden="true" /> {documentTitle(doc)}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-[14px] text-ink-500">When you scan an after-visit summary, you can keep the photos here. Only you can see them.</p>
              )}
              {documents.length > 5 ? (
                <Link href={`/circles/${id}/visits`} className="mt-2 inline-flex min-h-11 items-center text-[15px] font-semibold text-primary-700">
                  All {documents.length} saved summaries
                </Link>
              ) : null}
            </section>
          ) : null}
        </div>
      </CircleFrame>
    </>
  );
}
