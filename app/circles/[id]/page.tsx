import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { CircleFrame, circleTabs, roleLine } from "@/components/circles/CircleFrame";
import { GettingStarted } from "@/components/circles/GettingStarted";
import { Panel } from "@/components/circles/Panel";
import { PeopleList } from "@/components/circles/PeopleList";
import { RestoreKeys } from "@/components/circles/RestoreKeys";
import { CircleShell } from "@/components/circles/Shell";
import { SummaryView } from "@/components/circles/SummaryView";
import { getActor } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getCircle, listOwnCircleKeys } from "@/services/circles";
import { listPeople } from "@/services/members";

export const metadata: Metadata = { title: "Circle", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function CircleHome({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await getActor(id);
  if (!actor) redirect(`/login?next=/circles/${id}`);
  const content = await getCircle(actor, id);
  if (!content && actor.kind === "caregiver") notFound();
  const tabs = circleTabs(actor, id);
  const listed = await listPeople(actor, id);
  const people = listed.ok ? listed.people : null;
  const canManage = listed.ok && listed.canManage;
  const keys = actor.kind === "caregiver" ? await listOwnCircleKeys(actor) : [];
  const key = keys.find((item) => item.circleId === id) ?? null;
  const isOwner = actor.kind === "caregiver" && actor.role === "owner";
  return (
    <CircleShell signedIn={actor.kind === "caregiver"}>
      <CircleFrame personName={content?.person_name ?? "Your care circle"} subtitle={roleLine(actor)} tabs={tabs} active="overview">
        {key ? <RestoreKeys circles={[key]} /> : null}
        {isOwner && people ? (
          <div className="mb-8">
            <GettingStarted circleId={id} people={people} />
          </div>
        ) : null}
        <div className="grid gap-10 lg:grid-cols-[1.25fr_1fr] lg:gap-12">
          <Panel title="Care summary" href={can(actor, "summary:read", { circleId: id }) ? `/circles/${id}/summary` : null} linkLabel="See the full summary">
            {content ? <SummaryView content={content} compact /> : <p className="text-ink-500">The care summary is not shared with you.</p>}
          </Panel>
          {people ? (
            <Panel title="People" href={`/circles/${id}/members`} linkLabel={canManage ? "Add or manage people" : "See everyone"}>
              <PeopleList people={people.slice(0, 6)} showSeen={canManage} />
              {people.length > 6 ? <p className="mt-2 text-sm text-ink-500">And {people.length - 6} more.</p> : null}
            </Panel>
          ) : null}
        </div>
      </CircleFrame>
    </CircleShell>
  );
}
