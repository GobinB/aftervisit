import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { circleTabs } from "@/components/circles/CircleFrame";
import { CircleShell } from "@/components/circles/Shell";
import { MedicationForm } from "@/components/medications/MedicationForm";
import { getActor } from "@/lib/auth";
import { getCircle } from "@/services/circles";
import { getMedication } from "@/services/medications";

export const metadata: Metadata = { title: "Edit medication", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function EditMedicationPage({ params }: { params: Promise<{ id: string; medId: string }> }) {
  const { id, medId } = await params;
  const actor = await getActor(id);
  if (!actor) redirect(`/login?next=/circles/${id}/medications/${medId}`);
  const medication = /^[0-9a-f-]{36}$/i.test(medId) ? await getMedication(actor, id, medId) : null;
  if (!medication) notFound();
  const content = await getCircle(actor, id);
  const personName = content?.person_name ?? "Your care circle";
  return (
    <CircleShell signedIn circle={{ personName, tabs: circleTabs(actor, id), active: "medications" }}>
      <h1 className="font-display mb-1 text-[26px] leading-tight text-primary-900">{medication.name}</h1>
      <p className="mb-5 text-[13px] text-ink-500">Changes are saved to the history with today&apos;s date.</p>
      <MedicationForm circleId={id} medication={medication} />
    </CircleShell>
  );
}
