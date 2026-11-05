import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { CircleFrame, circleTabs, roleLine } from "@/components/circles/CircleFrame";
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
    <CircleShell signedIn={actor.kind === "caregiver"} circle={{ personName: circle?.person_name ?? "Your care circle", tabs: circleTabs(actor, id), active: "people" }}>
      <CircleFrame personName={circle?.person_name ?? "Your care circle"} subtitle={roleLine(actor)} tabs={circleTabs(actor, id)} active="people">
        {listed.canManage ? (
          <p className="mb-8 max-w-2xl text-ink-500">
            Each person gets their own link to just the parts you choose. You see a new link once: copy it, share it, or send it from your own
            mail app. All Hands Care does not send messages.
          </p>
        ) : null}
        <RestoreKeys circles={keys} />
        <MembersPanel circleId={id} people={listed.people} canManage={listed.canManage} keyVersion={keys[0]?.circleKeyVersion ?? null} />
      </CircleFrame>
    </CircleShell>
  );
}
