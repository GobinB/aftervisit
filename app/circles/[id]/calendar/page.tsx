import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Agenda } from "@/components/calendar/Agenda";
import { MonthGrid } from "@/components/calendar/MonthGrid";
import { circleTabs } from "@/components/circles/CircleFrame";
import { CircleShell } from "@/components/circles/Shell";
import { Card } from "@/components/circles/Today";
import { PrintButton } from "@/components/medications/PrintButton";
import { getActor } from "@/lib/auth";
import { calendarItems } from "@/lib/calendar-rows";
import { can } from "@/lib/permissions";
import { addDays, monthGrid, monthText, shiftMonth } from "@/lib/schema/events";
import { getCircle } from "@/services/circles";
import { listEvents } from "@/services/events";
import { listPeople } from "@/services/members";
import { listTodos } from "@/services/todos";

export const metadata: Metadata = { title: "Calendar", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const pill = (on: boolean) =>
  `inline-flex h-8 items-center rounded-full border px-3 text-[13px] font-medium ${on ? "border-primary-700 bg-primary-700 text-white" : "border-border-200 bg-white text-ink-900 hover:bg-paper-100"}`;

export default async function CalendarPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ view?: string; month?: string }> }) {
  const { id } = await params;
  const query = await searchParams;
  const actor = await getActor(id);
  if (!actor) redirect(`/login?next=/circles/${id}/calendar`);
  if (!can(actor, "calendar:read", { circleId: id })) notFound();
  const content = await getCircle(actor, id);
  const personName = content?.person_name ?? "Your care circle";
  const today = new Date().toISOString().slice(0, 10);
  const view = query.view === "month" ? "month" : "list";
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(query.month ?? "") ? (query.month as string) : today.slice(0, 7);
  const weeks = monthGrid(month);
  const from = view === "month" ? weeks[0][0] : addDays(today, -1);
  const to = view === "month" ? weeks[weeks.length - 1][6] : addDays(today, 62);
  const events = (await listEvents(actor, id, from, to)) ?? [];
  const todos = (await listTodos(actor, id)) ?? [];
  const listed = await listPeople(actor, id);
  const people = listed.ok ? listed.people : null;
  const items = calendarItems(actor, id, events, todos, people, from, to);
  const canEdit = can(actor, "calendar:edit", { circleId: id });
  const base = `/circles/${id}/calendar`;

  return (
    <CircleShell signedIn={actor.kind === "caregiver"} circle={{ personName, tabs: circleTabs(actor, id), active: "calendar" }}>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[26px] leading-tight tracking-[-0.01em] text-primary-900">Calendar</h1>
          <p className="mt-1 text-[13px] text-ink-500">{personName} · appointments, visits and to-dos that are due</p>
        </div>
        <div className="no-print flex flex-wrap items-center gap-2">
          <PrintButton />
          {canEdit ? (
            <Link href={`${base}/new`} className="inline-flex h-9 items-center gap-2 rounded-md bg-primary-700 px-3 text-[13px] font-semibold text-white hover:bg-primary-900">
              <Plus className="size-4" aria-hidden="true" /> Add an event
            </Link>
          ) : null}
        </div>
      </div>

      <div className="no-print mb-3 flex flex-wrap items-center justify-between gap-2">
        <nav aria-label="Calendar view" className="flex gap-1.5">
          <Link href={base} aria-current={view === "list" ? "page" : undefined} className={pill(view === "list")}>
            Upcoming
          </Link>
          <Link href={`${base}?view=month&month=${month}`} aria-current={view === "month" ? "page" : undefined} className={pill(view === "month")}>
            Month
          </Link>
        </nav>
        {view === "month" ? (
          <div className="flex items-center gap-1">
            <Link href={`${base}?view=month&month=${shiftMonth(month, -1)}`} aria-label="Previous month" className="inline-flex size-8 items-center justify-center rounded-md border border-border-200 bg-white hover:bg-paper-100">
              <ChevronLeft className="size-4" aria-hidden="true" />
            </Link>
            <span className="min-w-32 text-center text-[14px] font-semibold text-ink-900">{monthText(month)}</span>
            <Link href={`${base}?view=month&month=${shiftMonth(month, 1)}`} aria-label="Next month" className="inline-flex size-8 items-center justify-center rounded-md border border-border-200 bg-white hover:bg-paper-100">
              <ChevronRight className="size-4" aria-hidden="true" />
            </Link>
          </div>
        ) : null}
      </div>

      {view === "month" ? (
        <>
          <div className="hidden md:block">
            <MonthGrid month={month} items={items} circleId={id} canEdit={canEdit} />
          </div>
          <Card className="md:hidden">
            <Agenda items={items.filter((item) => item.date.startsWith(month))} circleId={id} canEdit={canEdit} empty={`Nothing in ${monthText(month)}.`} />
          </Card>
        </>
      ) : (
        <Card>
          <Agenda items={items} circleId={id} canEdit={canEdit} empty={canEdit ? "Nothing coming up. Add the next appointment." : "Nothing coming up."} />
        </Card>
      )}
    </CircleShell>
  );
}
