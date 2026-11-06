import { ArrowRight, UserPlus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { GettingStarted } from "@/components/circles/GettingStarted";
import { Agenda } from "@/components/calendar/Agenda";
import { ActivityFeed, AddDetails, Alerts, AtAGlance, Card, MedsGlance, PeopleCard, SectionLabel, StatCards, TodayHeader, TodosGlance } from "@/components/circles/Today";
import { InstallApp } from "@/components/pwa/InstallApp";
import { getActor } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { isMine, sortTodos } from "@/lib/schema/todos";
import { calendarItems } from "@/lib/calendar-rows";
import { addDays } from "@/lib/schema/events";
import { buildAlerts, buildFeed, buildTodayCards, missingDetails } from "@/lib/today";
import { todoRows, viewerOf } from "@/lib/todo-rows";
import { listActivity } from "@/services/activity";
import { getCircle } from "@/services/circles";
import { listEvents } from "@/services/events";
import { listMedications } from "@/services/medications";
import { listPeople } from "@/services/members";
import { listTodos } from "@/services/todos";

export const metadata: Metadata = { title: "Today", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** The home of every circle. The caregiver sees numbers, activity and what needs them; a helper sees what their role allows. */
export default async function CircleToday({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await getActor(id);
  if (!actor) redirect(`/login?next=/circles/${id}`);
  const today = new Date().toISOString().slice(0, 10);
  // Everything Today shows is read at once rather than one after another.
  const [content, listed, medications, todos, events, activity] = await Promise.all([
    getCircle(actor, id),
    listPeople(actor, id),
    listMedications(actor, id),
    listTodos(actor, id),
    // A wide window, so the activity list can name events added for far-off dates.
    listEvents(actor, id, addDays(today, -90), addDays(today, 365)),
    listActivity(actor, id),
  ]);
  if (!content && actor.kind === "caregiver") notFound();
  const personName = content?.person_name ?? "Your care circle";
  const people = listed.ok ? listed.people : null;
  const canManage = listed.ok && listed.canManage;
  const summaryHref = can(actor, "summary:read", { circleId: id }) ? `/circles/${id}/summary` : null;
  const peopleHref = `/circles/${id}/members`;
  const medsHref = `/circles/${id}/medications`;
  const viewer = viewerOf(actor);
  // The caregiver sees every open to-do; a helper sees theirs first, then ones they could take.
  const openTodos = sortTodos((todos ?? []).filter((todo) => todo.status === "open"));
  const nextTodos =
    actor.kind === "caregiver"
      ? openTodos
      : [...openTodos.filter((todo) => isMine(todo, viewer)), ...openTodos.filter((todo) => !todo.assignee)];
  const soonFrom = addDays(today, -1);
  const soonTo = addDays(today, 14);
  const soon = events ? calendarItems(actor, id, events, [], people, soonFrom, soonTo) : [];
  const needsSomeone = soon.filter((item) => item.needsSomeone).length;
  const comingUp = events ? (
    <section aria-labelledby="soon-title">
      <SectionLabel>
        <span id="soon-title">Coming up</span>
      </SectionLabel>
      <Card>
        <Agenda items={soon} circleId={id} canEdit={false} limit={5} empty="Nothing in the next two weeks." />
        <Link href={`/circles/${id}/calendar`} className="flex items-center gap-1 border-t border-border-200 px-4 py-2.5 text-[13px] font-semibold text-primary-700 hover:text-primary-900">
          Calendar <ArrowRight className="size-3.5" aria-hidden="true" />
        </Link>
      </Card>
    </section>
  ) : null;
  const todoSection = todos ? (
    <section aria-labelledby="todos-title">
      <SectionLabel>
        <span id="todos-title">{actor.kind === "caregiver" ? "Reminders" : "Your reminders"}</span>
      </SectionLabel>
      <TodosGlance
        todos={todoRows(actor, id, nextTodos.slice(0, 5), people)}
        circleId={id}
        href={`/circles/${id}/todos`}
        empty={actor.kind === "caregiver" ? "Nothing to do right now." : "Nothing is on your list."}
      />
    </section>
  ) : null;
  const meds = medications ? (
    <section aria-labelledby="meds-title">
      <SectionLabel>
        <span id="meds-title">Medications</span>
      </SectionLabel>
      <MedsGlance medications={medications} href={medsHref} />
    </section>
  ) : null;

  const header = (
    <TodayHeader
      personName={personName}
      help={
        canManage
          ? "Everything for today in one place. Tap a card to see more or add something; the menu takes you to each part."
          : "What is happening for " + personName + " today. Tap a card to see more."
      }
      actions={
        canManage ? (
          <Link
            href={peopleHref}
            className="inline-flex h-10 items-center gap-2 rounded-md border border-border-200 bg-white px-3.5 text-[14px] font-semibold text-primary-700 hover:bg-sky-100"
          >
            <UserPlus className="size-4" aria-hidden="true" /> Add a person
          </Link>
        ) : null
      }
    />
  );

  return (
    <>
      {header}
      {canManage && people ? (
        <>
          <StatCards stats={buildTodayCards(id, content, medications, todos)} />
          {/* After the scan card, so scanning stays the first thing on the screen. */}
          <div className="mt-5 empty:hidden">
            <InstallApp />
          </div>
          <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="min-w-0 space-y-5">
              {comingUp}
              {todoSection}
              <section aria-labelledby="activity-title">
                <SectionLabel>
                  <span id="activity-title">Recent activity</span>
                </SectionLabel>
                <ActivityFeed items={buildFeed(activity, people, 8, todos ?? [], events ?? [])} emptyHref={peopleHref} />
              </section>
              <section aria-labelledby="people-title">
                <SectionLabel>
                  <span id="people-title">People</span>
                </SectionLabel>
                <PeopleCard people={people.slice(0, 6)} showSeen href={peopleHref} linkLabel="Add or manage people" />
              </section>
            </div>
            {/* On phones, what needs the caregiver comes before the activity list. */}
            <div className="order-first space-y-5 lg:order-none">
              <GettingStarted circleId={id} people={people} />
              {missingDetails(id, content).length ? (
                <section aria-labelledby="details-title">
                  <SectionLabel>
                    <span id="details-title">Add their details</span>
                  </SectionLabel>
                  <AddDetails items={missingDetails(id, content)} />
                </section>
              ) : null}
              <section aria-labelledby="alerts-title">
                <SectionLabel>
                  <span id="alerts-title">Needs you</span>
                </SectionLabel>
                <Alerts
                  alerts={[
                    ...(needsSomeone
                      ? [{ key: "events", label: "Events that need someone to go", count: needsSomeone, tone: "amber" as const, href: `/circles/${id}/calendar` }]
                      : []),
                    ...buildAlerts(id, people, Date.now(), todos ?? []),
                  ]}
                />
              </section>
              {meds}
              {content ? (
                <section aria-labelledby="glance-title">
                  <SectionLabel>
                    <span id="glance-title">At a glance</span>
                  </SectionLabel>
                  <AtAGlance content={content} href={summaryHref} />
                </section>
              ) : null}
            </div>
          </div>
        </>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0 space-y-5">
            <InstallApp />
            {comingUp}
            {todoSection}
            {meds}
            {content ? (
              <section aria-labelledby="glance-title">
                <SectionLabel>
                  <span id="glance-title">At a glance</span>
                </SectionLabel>
                <AtAGlance content={content} href={summaryHref} />
              </section>
            ) : (
              <p className="text-ink-500">The care summary is not shared with you.</p>
            )}
          </div>
          {people ? (
            <section aria-labelledby="people-title">
              <SectionLabel>
                <span id="people-title">People</span>
              </SectionLabel>
              <PeopleCard people={people.slice(0, 6)} showSeen={false} href={peopleHref} linkLabel="See everyone" />
            </section>
          ) : null}
        </div>
      )}
    </>
  );
}
