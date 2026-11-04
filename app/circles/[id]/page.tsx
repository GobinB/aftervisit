import { FileText, UserPlus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { circleTabs } from "@/components/circles/CircleFrame";
import { GettingStarted } from "@/components/circles/GettingStarted";
import { RestoreKeys } from "@/components/circles/RestoreKeys";
import { CircleShell } from "@/components/circles/Shell";
import { ActivityFeed, Alerts, AtAGlance, MedsGlance, PeopleCard, SectionLabel, StatCards, TodayHeader, TodosGlance } from "@/components/circles/Today";
import { InstallApp } from "@/components/pwa/InstallApp";
import { getActor } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { isMine, sortTodos } from "@/lib/schema/todos";
import { buildAlerts, buildFeed, buildStats } from "@/lib/today";
import { todoRows, viewerOf } from "@/lib/todo-rows";
import { listActivity } from "@/services/activity";
import { getCircle, listOwnCircleKeys } from "@/services/circles";
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
  const content = await getCircle(actor, id);
  if (!content && actor.kind === "caregiver") notFound();
  const personName = content?.person_name ?? "Your care circle";
  const tabs = circleTabs(actor, id);
  const listed = await listPeople(actor, id);
  const people = listed.ok ? listed.people : null;
  const canManage = listed.ok && listed.canManage;
  const keys = actor.kind === "caregiver" ? await listOwnCircleKeys(actor) : [];
  const key = keys.find((item) => item.circleId === id) ?? null;
  const summaryHref = can(actor, "summary:read", { circleId: id }) ? `/circles/${id}/summary` : null;
  const peopleHref = `/circles/${id}/members`;
  const medications = await listMedications(actor, id);
  const medsHref = `/circles/${id}/medications`;
  const todos = await listTodos(actor, id);
  const viewer = viewerOf(actor);
  // The caregiver sees every open to-do; a helper sees theirs first, then ones they could take.
  const openTodos = sortTodos((todos ?? []).filter((todo) => todo.status === "open"));
  const nextTodos =
    actor.kind === "caregiver"
      ? openTodos
      : [...openTodos.filter((todo) => isMine(todo, viewer)), ...openTodos.filter((todo) => !todo.assignee)];
  const todoSection = todos ? (
    <section aria-labelledby="todos-title">
      <SectionLabel>
        <span id="todos-title">{actor.kind === "caregiver" ? "To-dos" : "Your to-dos"}</span>
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
      actions={
        canManage ? (
          <>
            <Link
              href="/new"
              className="inline-flex h-9 items-center gap-2 rounded-md border border-border-200 bg-white px-3 text-[13px] font-medium text-ink-900 hover:bg-paper-100"
            >
              <FileText className="size-4" aria-hidden="true" /> Share a visit summary
            </Link>
            <Link href={peopleHref} className="inline-flex h-9 items-center gap-2 rounded-md bg-primary-700 px-3 text-[13px] font-semibold text-white hover:bg-primary-900">
              <UserPlus className="size-4" aria-hidden="true" /> Add a person
            </Link>
          </>
        ) : null
      }
    />
  );

  return (
    <CircleShell signedIn={actor.kind === "caregiver"} circle={{ personName, tabs, active: "overview" }}>
      {key ? <RestoreKeys circles={[key]} /> : null}
      <InstallApp />
      {header}
      {canManage && people ? (
        <>
          <StatCards stats={buildStats(id, people, content, Date.now(), todos)} />
          <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="min-w-0 space-y-5">
              {todoSection}
              <section aria-labelledby="activity-title">
                <SectionLabel>
                  <span id="activity-title">Recent activity</span>
                </SectionLabel>
                <ActivityFeed items={buildFeed(await listActivity(actor, id), people, 8, todos ?? [])} emptyHref={peopleHref} />
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
              <section aria-labelledby="alerts-title">
                <SectionLabel>
                  <span id="alerts-title">Needs you</span>
                </SectionLabel>
                <Alerts alerts={buildAlerts(id, people, Date.now(), todos ?? [])} />
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
    </CircleShell>
  );
}
