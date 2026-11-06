import type { Metadata } from "next";
import { PageHead } from "@/components/circles/PageHead";
import { notFound, redirect } from "next/navigation";
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
  return (
    <>
      <PageHead
        back={{ href: `/circles/${id}/medications`, label: "Medications" }}
        title={medication.name}
        subtitle="Changes are saved to the history with today's date."
        help="Change the dose or how often, then save. Mark it stopped when the doctor stops it; it stays in the history."
      />
      <MedicationForm circleId={id} medication={medication} doctors={(content?.doctors ?? []).map((doctor) => doctor.name)} />
    </>
  );
}
