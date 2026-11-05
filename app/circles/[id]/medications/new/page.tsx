import type { Metadata } from "next";
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
      <h1 className="font-display mb-1 text-[26px] leading-tight text-primary-900">Add a medication</h1>
      <p className="mb-5 text-[13px] text-ink-500">For {personName}. Only the name is needed; add the rest when you have it.</p>
      <MedicationForm circleId={id} />
    </>
  );
}
