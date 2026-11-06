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
            {medications.length ? <PrintButton /> : null}
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
              <SectionLabel>
                <span id="scheduled-title">Taking now</span>
              </SectionLabel>
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
          <section aria-labelledby="changes-title" className="no-print">
            <SectionLabel>
              <span id="changes-title">Recent changes</span>
            </SectionLabel>
            <Card>
              {changes.length ? (
                <ul className="divide-y divide-border-200">
                  {changes.map((change) => (
                    <li key={change.id} className="flex items-start gap-3 px-4 py-2.5">
                      <span className="min-w-0 flex-1">
                        <span className="block text-[12px] font-semibold text-ink-500 uppercase">{CHANGE_LABEL[change.change]}</span>
                        <span className="block text-[13px] text-ink-900">{change.summary}</span>
                      </span>
                      <time dateTime={change.at} className="shrink-0 text-[12px] text-ink-500 tabular-nums">
                        <LocalDay iso={change.at} />
                      </time>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-4 py-3 text-[13px] text-ink-500">Every change will be listed here with its date.</p>
              )}
            </Card>
          </section>
        ) : null}
      </div>
    </>
  );
}
