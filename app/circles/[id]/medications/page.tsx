import { ScanLine, Plus } from "lucide-react";
import type { Metadata } from "next";
import { PageHead } from "@/components/circles/PageHead";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Card, SectionLabel } from "@/components/circles/Today";
import { TodayDate } from "@/components/circles/TodayDate";
import { MedicationList } from "@/components/medications/MedicationList";
import { PrintButton } from "@/components/medications/PrintButton";
import { LocalDay } from "@/components/LocalDay";
import { getActor } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getCircle } from "@/services/circles";
import { listMedicationChanges, listMedications } from "@/services/medications";

export const metadata: Metadata = { title: "Medications", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const CHANGE_LABEL = { added: "Added", edited: "Changed", stopped: "Stopped", restarted: "Restarted" } as const;

export default async function MedicationsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await getActor(id);
  if (!actor) redirect(`/login?next=/circles/${id}/medications`);
  const canEdit = can(actor, "medications:edit", { circleId: id });
  const [medications, content, changes] = await Promise.all([
    listMedications(actor, id),
    getCircle(actor, id),
    canEdit ? listMedicationChanges(actor, id) : Promise.resolve([]),
  ]);
  if (!medications) notFound();
  const personName = content?.person_name ?? "Your care circle";
  const scheduled = medications.filter((med) => med.status === "active" && med.schedule !== "as_needed");
  const asNeeded = medications.filter((med) => med.status === "active" && med.schedule === "as_needed");
  const stopped = medications.filter((med) => med.status === "stopped");
  const allergies = content?.allergies ?? [];

  return (
    <>
      <PageHead
        title="Medications"
        subtitle={
          <>
            {personName} · {scheduled.length + asNeeded.length} taking now · <TodayDate />
          </>
        }
        help="What is being taken now. Tap a medicine to change it, or scan an after-visit summary to update the list for you."
        actions={
          <>
            {medications.length ? <PrintButton className="max-sm:hidden" /> : null}
            {canEdit ? (
              <Link
                href={`/new?circle=${id}`}
                className="inline-flex h-10 items-center gap-2 rounded-md border border-border-200 bg-white px-3.5 text-[14px] font-medium text-ink-900 hover:bg-paper-100"
              >
                <ScanLine className="size-4" aria-hidden="true" /> Scan after-visit summary
              </Link>
            ) : null}
            {canEdit ? (
              <Link
                href={`/circles/${id}/medications/new`}
                className="inline-flex h-10 items-center gap-2 rounded-md bg-primary-700 px-3.5 text-[14px] font-semibold text-white hover:bg-primary-900"
              >
                <Plus className="size-4" aria-hidden="true" /> Add a medication
              </Link>
            ) : null}
          </>
        }
      />

      {allergies.length ? (
        <p className="mb-5 rounded-lg border border-attn-bg bg-attn-bg/50 px-4 py-2.5 text-[13px] text-attn-ink">
          <span className="font-semibold">Allergies:</span> {allergies.join(", ")}
        </p>
      ) : null}

      <div className={`grid gap-5 ${canEdit ? "lg:grid-cols-[minmax(0,1fr)_320px]" : ""}`}>
        <div className="min-w-0 space-y-5">
          {medications.length === 0 ? (
            <Card className="px-4 py-10 text-center">
              <p className="text-[15px] font-medium text-ink-900">No medications yet</p>
              <p className="mt-1 text-[13px] text-ink-500">
                {canEdit ? "Add each one with its strength and when it is taken." : "The caregiver has not added any yet."}
              </p>
              {canEdit ? (
                <Link
                  href={`/circles/${id}/medications/new`}
                  className="mt-4 inline-flex h-9 items-center gap-2 rounded-md bg-primary-700 px-3 text-[13px] font-semibold text-white hover:bg-primary-900"
                >
                  <Plus className="size-4" aria-hidden="true" /> Add a medication
                </Link>
              ) : null}
            </Card>
          ) : null}
          {scheduled.length ? (
            <section aria-labelledby="scheduled-title">
              {/* Bold and green, so what is taken now stands out from what was stopped. */}
              <h2 id="scheduled-title" className="mb-2 flex items-center gap-2 text-name font-bold text-ok-ink">
                <span className="size-2.5 rounded-full bg-ok" aria-hidden="true" />
                Taking now ({scheduled.length})
              </h2>
              <Card>
                <MedicationList medications={scheduled} circleId={id} canEdit={canEdit} />
              </Card>
            </section>
          ) : null}
          {asNeeded.length ? (
            <section aria-labelledby="as-needed-title">
              <SectionLabel>
                <span id="as-needed-title">Only when needed</span>
              </SectionLabel>
              <Card>
                <MedicationList medications={asNeeded} circleId={id} canEdit={canEdit} />
              </Card>
            </section>
          ) : null}
          {/* On phones, Print sits under the list rather than among the buttons at the top. */}
          {medications.length ? <PrintButton className="sm:hidden" /> : null}
          {stopped.length ? (
            <section aria-labelledby="stopped-title" className="no-print">
              <SectionLabel>
                <span id="stopped-title">Stopped</span>
              </SectionLabel>
              <Card>
                <MedicationList medications={stopped} circleId={id} canEdit={canEdit} />
              </Card>
            </section>
          ) : null}
        </div>
        {canEdit ? (
          // Folded away; opened when wanted.
          <details className="no-print group self-start rounded-lg border border-border-200 bg-white">
            <summary className="flex min-h-12 cursor-pointer items-center justify-between gap-2 px-4 text-label font-semibold text-ink-900">
              Recent changes{changes.length ? ` (${changes.length})` : ""}
              <span className="text-hint font-medium text-primary-700 group-open:hidden">Show</span>
              <span className="hidden text-hint font-medium text-primary-700 group-open:inline">Hide</span>
            </summary>
            {changes.length ? (
              <ul className="divide-y divide-border-200 border-t border-border-200">
                {changes.map((change) => (
                  <li key={change.id} className="flex items-start gap-3 px-4 py-2.5">
                    <span className="min-w-0 flex-1">
                      <span className="block text-hint font-semibold text-ink-500 uppercase">{CHANGE_LABEL[change.change]}</span>
                      <span className="block text-hint text-ink-900">{change.summary}</span>
                    </span>
                    <time dateTime={change.at} className="shrink-0 text-hint text-ink-500 tabular-nums">
                      <LocalDay iso={change.at} />
                    </time>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="border-t border-border-200 px-4 py-3 text-hint text-ink-500">Every change will be listed here with its date.</p>
            )}
          </details>
        ) : null}
      </div>
    </>
  );
}
