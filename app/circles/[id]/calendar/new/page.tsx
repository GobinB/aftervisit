import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { EventForm } from "@/components/calendar/EventForm";
import { circleTabs } from "@/components/circles/CircleFrame";
import { CircleShell } from "@/components/circles/Shell";
import { getActor } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getCircle } from "@/services/circles";
import { listPeople } from "@/services/members";

export const metadata: Metadata = { title: "Add an event", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function NewEventPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ date?: string }> }) {
  const { id } = await params;
  const { date } = await searchParams;
  const actor = await getActor(id);
  if (!actor) redirect(`/login?next=/circles/${id}/calendar/new`);
  if (!can(actor, "calendar:edit", { circleId: id })) notFound();
  const content = await getCircle(actor, id);
  const personName = content?.person_name ?? "Your care circle";
  const listed = await listPeople(actor, id);
  const people = (listed.ok ? listed.people : [])
    .filter((person) => person.kind === "member" && !person.revokedAt)
    .map((person) => ({ value: person.id, label: actor.kind === "helper" && person.id === actor.memberId ? "Me" : `${person.name} (${person.roleLabel})` }));
  return (
    <CircleShell signedIn={actor.kind === "caregiver"} circle={{ personName, tabs: circleTabs(actor, id), active: "calendar" }}>
      <h1 className="font-display mb-1 text-[26px] leading-tight text-primary-900">Add an event</h1>
      <p className="mb-5 text-[13px] text-ink-500">For {personName}. Everyone who can see the calendar will see it.</p>
      <EventForm
        circleId={id}
        people={people}
        initialDate={/^\d{4}-\d{2}-\d{2}$/.test(date ?? "") ? date : undefined}
        canDelete={false}
        isCaregiver={actor.kind === "caregiver"}
      />
    </CircleShell>
  );
}
