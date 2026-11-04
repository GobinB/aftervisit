import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { EventForm } from "@/components/calendar/EventForm";
import { circleTabs } from "@/components/circles/CircleFrame";
import { CircleShell } from "@/components/circles/Shell";
import { getActor } from "@/lib/auth";
import { getCircle } from "@/services/circles";
import { getEvent } from "@/services/events";
import { listPeople } from "@/services/members";

export const metadata: Metadata = { title: "Edit event", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function EditEventPage({ params }: { params: Promise<{ id: string; eventId: string }> }) {
  const { id, eventId } = await params;
  const actor = await getActor(id);
  if (!actor) redirect(`/login?next=/circles/${id}/calendar/${eventId}`);
  const event = /^[0-9a-f-]{36}$/i.test(eventId) ? await getEvent(actor, id, eventId) : null;
  if (!event) notFound();
  const content = await getCircle(actor, id);
  const personName = content?.person_name ?? "Your care circle";
  const listed = await listPeople(actor, id);
  const people = (listed.ok ? listed.people : [])
    .filter((person) => person.kind === "member" && !person.revokedAt)
    .map((person) => ({ value: person.id, label: actor.kind === "helper" && person.id === actor.memberId ? "Me" : `${person.name} (${person.roleLabel})` }));
  return (
    <CircleShell signedIn={actor.kind === "caregiver"} circle={{ personName, tabs: circleTabs(actor, id), active: "calendar" }}>
      <h1 className="font-display mb-5 text-[26px] leading-tight text-primary-900">Edit event</h1>
      <EventForm circleId={id} people={people} event={event} canDelete={actor.kind === "caregiver"} isCaregiver={actor.kind === "caregiver"} />
    </CircleShell>
  );
}
