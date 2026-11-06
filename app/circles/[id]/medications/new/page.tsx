import type { Metadata } from "next";
import { PageHead } from "@/components/circles/PageHead";
import { notFound, redirect } from "next/navigation";
import { MedicationForm } from "@/components/medications/MedicationForm";
import { getActor } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getCircle } from "@/services/circles";

export const metadata: Metadata = { title: "Add a medication", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function NewMedicationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await getActor(id);
  if (!actor) redirect(`/login?next=/circles/${id}/medications/new`);
  if (!can(actor, "medications:edit", { circleId: id })) notFound();
  const content = await getCircle(actor, id);
  const personName = content?.person_name ?? "Your care circle";
  return (
    <>
      <PageHead
        back={{ href: `/circles/${id}/medications`, label: "Medications" }}
        title="Add a medication"
        subtitle={`For ${personName}. Only the name is needed; add the rest when you have it.`}
        help="Start typing the name and tap it in the list. Then tap the dose and how often, or type your own."
      />
      <MedicationForm circleId={id} />
    </>
  );
}
