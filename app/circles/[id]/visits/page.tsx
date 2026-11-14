import { ChevronRight, FileText, Images } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CircleKeyCheck } from "@/components/circles/CircleKeyCheck";
import { PageHead } from "@/components/circles/PageHead";
import { getActor } from "@/lib/auth";
import { documentTitle } from "@/lib/schema/documents";
import { getCircleKeyState } from "@/services/circle-keys";
import { listDocuments } from "@/services/documents";

export const metadata: Metadata = { title: "Saved visit summaries", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** Every after-visit summary the caregiver chose to keep, newest first. Only the caregiver sees this. */
export default async function VisitsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await getActor(id);
  if (!actor) redirect(`/login?next=/circles/${id}/visits`);
  const [documents, key] = await Promise.all([listDocuments(actor, id), getCircleKeyState(actor, id)]);
  if (!documents) notFound();
  return (
    <>
      <PageHead
        back={{ href: `/circles/${id}/summary`, label: "Care summary" }}
        title="Saved visit summaries"
        subtitle="Only you can see these."
        help="The photos of after-visit summaries you chose to keep when you scanned them. Tap one to look at it, or to delete it."
      />
      {/* Only for summaries locked with recovery words that no device has handed over: type the words, or start fresh. */}
      {key?.state === "words" ? <CircleKeyCheck circleId={id} /> : null}
      {documents.length ? (
        <ul className="divide-y divide-border-200 overflow-hidden rounded-lg border border-border-200 bg-white">
          {documents.map((doc) => (
            <li key={doc.id}>
              <Link href={`/circles/${id}/visits/${doc.id}`} className="flex min-h-16 items-center gap-3 px-4 py-3 hover:bg-sky-100/50">
                {doc.kind === "pdf" ? <FileText className="size-6 shrink-0 text-primary-700" aria-hidden="true" /> : <Images className="size-6 shrink-0 text-primary-700" aria-hidden="true" />}
                <span className="min-w-0 flex-1 text-[16px] font-semibold text-ink-900">{documentTitle(doc)}</span>
                <ChevronRight className="size-5 text-ink-500" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-lg border border-border-200 bg-white px-4 py-8 text-center text-[15px] text-ink-500">
          None yet. When you scan an after-visit summary, leave &ldquo;Keep the photos&rdquo; on to save them here.
        </p>
      )}
    </>
  );
}
