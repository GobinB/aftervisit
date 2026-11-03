import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { MembersPanel } from "@/components/circles/MembersPanel";
import { RestoreKeys } from "@/components/circles/RestoreKeys";
import { CircleShell } from "@/components/circles/Shell";
import { getActor } from "@/lib/auth";
import { getCircle, listOwnCircleKeys } from "@/services/circles";
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
  const keys = actor.kind === "caregiver" ? (await listOwnCircleKeys(actor)).filter((item) => item.circleId === id) : [];
  return (
    <CircleShell>
      <Link href={`/circles/${id}`} className="font-semibold text-primary-700">
        Back
      </Link>
      <h1 className="font-display mt-2 text-page text-primary-900">People{circle ? ` for ${circle.person_name}` : ""}</h1>
      <p className="mt-2 mb-6 text-ink-500">Links are shown once. Copy, share, or open them in your own mail app. The part after # carries the key for files and stays in the browser. AfterVisit does not receive it and does not send messages.</p>
      <RestoreKeys circles={keys} />
      <MembersPanel circleId={id} people={listed.people} canManage={listed.canManage} keyVersion={keys[0]?.circleKeyVersion ?? null} />
    </CircleShell>
  );
}
