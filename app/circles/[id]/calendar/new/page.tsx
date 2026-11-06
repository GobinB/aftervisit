import type { Metadata } from "next";
import { PageHead } from "@/components/circles/PageHead";
import { notFound, redirect } from "next/navigation";
import { EventForm } from "@/components/calendar/EventForm";
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
    <>
      <PageHead
        back={{ href: `/circles/${id}/calendar`, label: "Calendar" }}
        title="Add an event"
        subtitle={`For ${personName}. Everyone who can see the calendar will see it.`}
        help="Give it a name and a day. Pick who is going, or leave it open so someone can offer."
      />
      <EventForm
        circleId={id}
        people={people}
        initialDate={/^\d{4}-\d{2}-\d{2}$/.test(date ?? "") ? date : undefined}
        canDelete={false}
        isCaregiver={actor.kind === "caregiver"}
        doctors={content?.doctors ?? []}
      />
    </>
  );
}
