import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { CircleFrame, circleTabs, roleLine } from "@/components/circles/CircleFrame";
import { MembersPanel } from "@/components/circles/MembersPanel";
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
    <>
      <CircleFrame personName={circle?.person_name ?? "Your care circle"} subtitle={roleLine(actor)} tabs={circleTabs(actor, id)} help="Everyone who helps. Add a person to give them their own link. Tap a name to share their link, make a new one, or remove them." active="people">
        <MembersPanel circleId={id} personName={circle?.person_name ?? "the circle"} people={listed.people} canManage={listed.canManage} />
      </CircleFrame>
    </>
  );
}
