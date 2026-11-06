import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { CalendarLink } from "@/components/calendar/CalendarLink";
import { PageHead } from "@/components/circles/PageHead";
import { getActor } from "@/lib/auth";
import { getFeed } from "@/services/calendar-feed";
import { getCircle } from "@/services/circles";

export const metadata: Metadata = { title: "Add to your calendar", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** Shows the circle's appointments in Google Calendar, Apple Calendar or Outlook. Only the caregiver. */
export default async function SubscribePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await getActor(id);
  if (!actor) redirect(`/login?next=/circles/${id}/calendar/subscribe`);
  const [feed, content] = await Promise.all([getFeed(actor, id), getCircle(actor, id)]);
  if (feed === undefined || !content) notFound();
  return (
    <>
      <PageHead
        back={{ href: `/circles/${id}/calendar`, label: "Calendar" }}
        title="Add to your calendar"
        subtitle={`See ${content.person_name}'s appointments in the calendar you already use.`}
        help="Turn on the link once, then tap your calendar app. Appointments and reminders appear there and keep up to date by themselves."
      />
      <CalendarLink circleId={id} personName={content.person_name} initialUrl={feed?.url ?? null} />
    </>
  );
}
