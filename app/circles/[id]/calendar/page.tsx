import { CalendarPlus, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import type { Metadata } from "next";
import { PageHead } from "@/components/circles/PageHead";
import Link from "next/link";
import { PendingLink } from "@/components/ui/PendingLink";
import { notFound, redirect } from "next/navigation";
import { Agenda } from "@/components/calendar/Agenda";
import { MonthGrid } from "@/components/calendar/MonthGrid";
import { Card } from "@/components/circles/Today";
import { PrintButton } from "@/components/medications/PrintButton";
import { getActor } from "@/lib/auth";
import { calendarItems } from "@/lib/calendar-rows";
import { can } from "@/lib/permissions";
import { addDays, dayText, monthGrid, monthText, shiftMonth } from "@/lib/schema/events";
import { medsOnDay } from "@/lib/med-days";
import { buildWeek, weekDays, weekStart, weekText } from "@/lib/week-layout";
import { WeekGrid, WeekKey } from "@/components/calendar/WeekGrid";
import { DayMeds } from "@/components/calendar/DayMeds";
import { listMedications } from "@/services/medications";
import { getCircle } from "@/services/circles";
import { listEvents } from "@/services/events";
import { listPeople } from "@/services/members";
import { listTodos } from "@/services/todos";

export const metadata: Metadata = { title: "Calendar", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** One segment of the Week / Month / List switch. */
const segment = (on: boolean) =>
  `inline-flex min-h-10 items-center gap-1.5 rounded-md px-4 text-[15px] font-semibold ${on ? "bg-white text-primary-900 shadow-sm ring-1 ring-border-200" : "text-ink-500 hover:text-ink-900"}`;
const arrow = "inline-flex size-11 items-center justify-center rounded-md border border-border-200 bg-white hover:bg-paper-100";

export default async function CalendarPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ view?: string; month?: string; date?: string; week?: string }> }) {
  const { id } = await params;
  const query = await searchParams;
  const actor = await getActor(id);
  if (!actor) redirect(`/login?next=/circles/${id}/calendar`);
  if (!can(actor, "calendar:read", { circleId: id })) notFound();
  const content = await getCircle(actor, id);
  const personName = content?.person_name ?? "Your care circle";
  const today = new Date().toISOString().slice(0, 10);
  // The week is the default view; Month, List and a single day are one tap away.
  const isDate = (value?: string) => /^\d{4}-\d{2}-\d{2}$/.test(value ?? "");
  const view = query.view === "month" ? "month" : query.view === "list" ? "list" : query.view === "day" && isDate(query.date) ? "day" : "week";
  const week = weekStart(isDate(query.week) ? (query.week as string) : today);
  const day = view === "day" ? (query.date as string) : today;
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(query.month ?? "") ? (query.month as string) : today.slice(0, 7);
  const weeks = monthGrid(month);
  const from = view === "month" ? weeks[0][0] : view === "day" ? day : view === "week" ? week : addDays(today, -1);
  const to = view === "month" ? weeks[weeks.length - 1][6] : view === "day" ? day : view === "week" ? addDays(week, 6) : addDays(today, 62);
  const seesMeds = can(actor, "medications:read", { circleId: id });
  const [eventRows, todoRows, listed, medRows] = await Promise.all([
    listEvents(actor, id, from, to),
    listTodos(actor, id),
    listPeople(actor, id),
    seesMeds ? listMedications(actor, id) : Promise.resolve(null),
  ]);
  const meds = medRows ?? [];
  // How many medicines are due each day in view, for the grid and the day headers.
  const medCounts: Record<string, number> = {};
  if (seesMeds) for (let date = from; date <= to; date = addDays(date, 1)) medCounts[date] = medsOnDay(meds, date).length;
  const events = eventRows ?? [];
  const todos = todoRows ?? [];
  const people = listed.ok ? listed.people : null;
  const items = calendarItems(actor, id, events, todos, people, from, to);
  const canEdit = can(actor, "calendar:edit", { circleId: id });
  const base = `/circles/${id}/calendar`;

  if (view === "day") {
    return (
      <>
        <PageHead
          back={{ href: `${base}?week=${weekStart(day)}`, label: "Week" }}
          title={dayText(day)}
          subtitle={personName}
          help="Everything on this day: appointments, reminders that are due, and the medicines to take, by time of day."
          actions={
            canEdit ? (
              <Link href={`${base}/new?date=${day}`} className="inline-flex h-10 items-center gap-2 rounded-md bg-primary-700 px-3.5 text-[14px] font-semibold text-white hover:bg-primary-900">
                <Plus className="size-4" aria-hidden="true" /> Add an event
              </Link>
            ) : null
          }
        />
        <div className="no-print mb-3 flex gap-2">
          <PendingLink href={`${base}?view=day&date=${addDays(day, -1)}`} className="inline-flex h-11 items-center gap-1 rounded-lg border border-border-200 bg-white px-3 text-[14px] font-semibold text-primary-700 hover:bg-sky-100">
            <ChevronLeft className="size-4" aria-hidden="true" /> Day before
          </PendingLink>
          <PendingLink href={`${base}?view=day&date=${addDays(day, 1)}`} className="inline-flex h-11 items-center gap-1 rounded-lg border border-border-200 bg-white px-3 text-[14px] font-semibold text-primary-700 hover:bg-sky-100">
            Next day <ChevronRight className="size-4" aria-hidden="true" />
          </PendingLink>
        </div>
        <h2 className="mb-2 text-[12px] font-bold tracking-[0.1em] text-ink-500 uppercase">Appointments and reminders</h2>
        <Card className="mb-5">
          <Agenda items={items} circleId={id} canEdit={canEdit} fromToday={false} empty="Nothing planned this day." />
        </Card>
        {seesMeds ? (
          <>
            <h2 className="mb-2 text-[12px] font-bold tracking-[0.1em] text-ink-500 uppercase">Medicines</h2>
            <Card>
              <DayMeds doses={medsOnDay(meds, day)} />
            </Card>
          </>
        ) : null}
      </>
    );
  }

  return (
    <>
      <PageHead
        title="Calendar"
        subtitle={`${personName} · appointments, reminders and medicines`}
        help="Your week at a glance, coloured by kind: appointments, ones that need someone to go, reminders and medicines. Tap a card to open it, or a day to see everything on it."
        actions={
          <>
            <PrintButton />
            {actor.kind === "caregiver" ? (
              <Link
                href={`${base}/subscribe`}
                className="inline-flex h-10 items-center gap-2 rounded-md border border-border-200 bg-white px-3.5 text-[14px] font-medium text-ink-900 hover:bg-paper-100"
              >
                <CalendarPlus className="size-4" aria-hidden="true" /> Add to my calendar
              </Link>
            ) : null}
            {canEdit ? (
              <Link href={`${base}/new`} className="inline-flex h-10 items-center gap-2 rounded-md bg-primary-700 px-3.5 text-[14px] font-semibold text-white hover:bg-primary-900">
                <Plus className="size-4" aria-hidden="true" /> Add an event
              </Link>
            ) : null}
          </>
        }
      />

      <div className="no-print mb-3 flex flex-wrap items-center justify-between gap-2">
        <nav aria-label="Calendar view" className="inline-flex gap-1 rounded-lg bg-paper-100 p-1 ring-1 ring-border-200">
          <PendingLink href={base} aria-current={view === "week" ? "page" : undefined} className={segment(view === "week")}>
            Week
          </PendingLink>
          <PendingLink href={`${base}?view=month&month=${month}`} aria-current={view === "month" ? "page" : undefined} className={segment(view === "month")}>
            Month
          </PendingLink>
          <PendingLink href={`${base}?view=list`} aria-current={view === "list" ? "page" : undefined} className={segment(view === "list")}>
            List
          </PendingLink>
        </nav>
        {view === "week" ? (
          <div className="flex items-center gap-1">
            <PendingLink href={`${base}?week=${addDays(week, -7)}`} aria-label="Previous week" className={arrow}>
              <ChevronLeft className="size-5" aria-hidden="true" />
            </PendingLink>
            <span className="min-w-36 text-center text-[14px] font-semibold text-ink-900">{weekText(week)}</span>
            <PendingLink href={`${base}?week=${addDays(week, 7)}`} aria-label="Next week" className={arrow}>
              <ChevronRight className="size-5" aria-hidden="true" />
            </PendingLink>
            {week !== weekStart(today) ? (
              <PendingLink href={base} className="ml-1 inline-flex min-h-11 items-center rounded-md border border-border-200 bg-white px-3 text-[14px] font-semibold text-primary-700 hover:bg-sky-100">
                This week
              </PendingLink>
            ) : null}
          </div>
        ) : null}
        {view === "month" ? (
          <div className="flex items-center gap-1">
            <PendingLink href={`${base}?view=month&month=${shiftMonth(month, -1)}`} aria-label="Previous month" className={arrow}>
              <ChevronLeft className="size-5" aria-hidden="true" />
            </PendingLink>
            <span className="min-w-32 text-center text-[14px] font-semibold text-ink-900">{monthText(month)}</span>
            <PendingLink href={`${base}?view=month&month=${shiftMonth(month, 1)}`} aria-label="Next month" className={arrow}>
              <ChevronRight className="size-5" aria-hidden="true" />
            </PendingLink>
          </div>
        ) : null}
      </div>

      {view === "week" ? (
        <>
          <div className="no-print mb-2">
            <WeekKey kinds={seesMeds ? ["event", "needs", "reminder", "meds"] : ["event", "needs", "reminder"]} />
          </div>
          <WeekGrid
            week={buildWeek({
              start: week,
              items,
              meds: seesMeds ? Object.fromEntries(weekDays(week).map((date) => [date, medsOnDay(meds, date)])) : {},
              base,
              canEdit,
            })}
            base={base}
            canEdit={canEdit}
          />
          <p className="mt-2 text-[13px] text-ink-500 lg:hidden">Slide sideways to see the whole week. Tap a day to see everything on it.</p>
        </>
      ) : view === "month" ? (
        <>
          <div className="hidden md:block">
            <MonthGrid month={month} items={items} circleId={id} canEdit={canEdit} medCounts={medCounts} />
          </div>
          <Card className="md:hidden">
            <Agenda items={items.filter((item) => item.date.startsWith(month))} circleId={id} canEdit={canEdit} empty={`Nothing in ${monthText(month)}.`} dayBase={base} medCounts={medCounts} />
          </Card>
        </>
      ) : (
        <>
          {seesMeds && medCounts[today] ? (
            <section aria-labelledby="today-meds" className="mb-5">
              <h2 id="today-meds" className="mb-2 flex items-center justify-between text-[12px] font-bold tracking-[0.1em] text-ink-500 uppercase">
                Medicines today
                <Link href={`${base}?view=day&date=${today}`} className="text-[13px] font-semibold tracking-normal text-primary-700 normal-case hover:text-primary-900">
                  Whole day
                </Link>
              </h2>
              <Card>
                <DayMeds doses={medsOnDay(meds, today)} />
              </Card>
            </section>
          ) : null}
          <Card>
            <Agenda items={items} circleId={id} canEdit={canEdit} empty={canEdit ? "Nothing coming up. Add the next appointment." : "Nothing coming up."} dayBase={base} medCounts={medCounts} />
          </Card>
        </>
      )}
    </>
  );
}
