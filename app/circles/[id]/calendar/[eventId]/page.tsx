import type { Metadata } from "next";
import { PageHead } from "@/components/circles/PageHead";
import { notFound, redirect } from "next/navigation";
import { EventForm } from "@/components/calendar/EventForm";
import { getActor } from "@/lib/auth";
import { getEvent } from "@/services/events";
import { getCircle } from "@/services/circles";
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
  const listed = await listPeople(actor, id);
  const people = (listed.ok ? listed.people : [])
    .filter((person) => person.kind === "member" && !person.revokedAt)
    .map((person) => ({ value: person.id, label: actor.kind === "helper" && person.id === actor.memberId ? "Me" : `${person.name} (${person.roleLabel})` }));
  return (
    <>
      <PageHead
        back={{ href: `/circles/${id}/calendar`, label: "Calendar" }}
        title="Edit event"
        help="Change the day, time or who is going, then save."
      />
      <EventForm circleId={id} people={people} event={event} canDelete={actor.kind === "caregiver"} isCaregiver={actor.kind === "caregiver"}
        doctors={content?.doctors ?? []} />
    </>
  );
}
