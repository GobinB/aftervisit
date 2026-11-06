import { FileText } from "lucide-react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PageHead } from "@/components/circles/PageHead";
import { DeleteDocument } from "@/components/documents/DeleteDocument";
import { getActor } from "@/lib/auth";
import { documentTitle } from "@/lib/schema/documents";
import { getDocument } from "@/services/documents";

export const metadata: Metadata = { title: "Saved visit summary", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function VisitDocumentPage({ params }: { params: Promise<{ id: string; docId: string }> }) {
  const { id, docId } = await params;
  const actor = await getActor(id);
  if (!actor) redirect(`/login?next=/circles/${id}/visits/${docId}`);
  const doc = /^[0-9a-f-]{36}$/i.test(docId) ? await getDocument(actor, id, docId) : null;
  if (!doc) notFound();
  const page = (n: number) => `/api/circles/${id}/documents/${doc.id}/pages/${n}`;
  return (
    <>
      <PageHead
        back={{ href: `/circles/${id}/visits`, label: "Saved summaries" }}
        title={documentTitle(doc)}
        subtitle="Only you can see this."
        help="The pages as you photographed them. Tap a page to open it full size, where you can zoom in."
      />
      {doc.kind === "pdf" ? (
        <a
          href={page(1)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-12 items-center gap-2 rounded-lg bg-primary-700 px-5 text-[16px] font-semibold text-white hover:bg-primary-900"
        >
          <FileText className="size-5" aria-hidden="true" /> Open the PDF
        </a>
      ) : (
        <ol className="space-y-4">
          {Array.from({ length: doc.saved }, (_, i) => i + 1).map((n) => (
            <li key={n} className="overflow-hidden rounded-lg border border-border-200 bg-white">
              <p className="border-b border-border-200 px-4 py-2 text-[13px] font-semibold text-ink-500">
                Page {n} of {doc.saved}
              </p>
              <a href={page(n)} target="_blank" rel="noreferrer" aria-label={`Open page ${n} full size`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={page(n)} alt={`Page ${n} of the after-visit summary`} loading="lazy" className="block h-auto w-full" />
              </a>
            </li>
          ))}
        </ol>
      )}
      {doc.saved < doc.pageCount ? (
        <p className="mt-4 rounded-md bg-attn-bg px-3 py-2 text-[14px] text-attn-ink">
          {doc.pageCount - doc.saved} page{doc.pageCount - doc.saved === 1 ? " was" : "s were"} not kept because the connection dropped.
        </p>
      ) : null}
      <div className="mt-8">
        <DeleteDocument circleId={id} id={doc.id} />
      </div>
    </>
  );
}
