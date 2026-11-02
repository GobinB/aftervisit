import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { MembersPanel } from "@/components/circles/MembersPanel";
import { CircleShell } from "@/components/circles/Shell";
import { getActor } from "@/lib/auth";
import { getCircle } from "@/services/circles";
import { listPeople } from "@/services/members";

export const metadata: Metadata = { title: "People", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function MembersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await getActor(id);
  if (!actor) redirect(`/login?next=/circles/${id}/members`);
  const listed = await listPeople(actor, id);
  if (!listed.ok) notFound();
  const circle = await getCircle(actor, id);
  return (
    <CircleShell>
      <Link href={`/circles/${id}`} className="font-semibold text-primary-700">
        Back
      </Link>
      <h1 className="font-display mt-2 text-page text-primary-900">People{circle ? ` for ${circle.person_name}` : ""}</h1>
      <p className="mt-2 mb-6 text-ink-500">Links are shown once. Copy, share, or open them in your own mail app. AfterVisit does not send messages.</p>
      <MembersPanel circleId={id} people={listed.people} canManage={listed.canManage} />
    </CircleShell>
  );
}
