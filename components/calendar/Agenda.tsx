"use client";

import { ListChecks, MapPin, Pencil, Pill, Repeat } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { GoButton } from "@/components/calendar/GoButton";
import type { CalendarItem } from "@/lib/calendar-rows";
import { addDays, dayText } from "@/lib/schema/events";
import { localToday } from "@/lib/schema/todos";

/**
 * Upcoming dates, grouped by day, starting from the viewer's own today.
 * The server sends a day either side so time zones never hide today's events.
 */
export function Agenda({
  items,
  circleId,
  canEdit,
  limit,
  empty,
  fromToday = true,
  dayBase,
  medCounts,
}: {
  items: CalendarItem[];
  circleId: string;
  canEdit: boolean;
  limit?: number;
  empty: string;
  /** False shows every item given, for fictional previews with fixed dates. */
  fromToday?: boolean;
  /** The calendar's address; each day's header then opens that day. */
  dayBase?: string;
  /** How many medicines are due each day, shown beside the day's name. */
  medCounts?: Record<string, number>;
}) {
  const [today, setToday] = useState<string | null>(null);
  useEffect(() => setToday(localToday()), []);
  const shown = (fromToday && today ? items.filter((item) => item.date >= today) : items).slice(0, limit ?? items.length);
  if (!shown.length) return <p className="px-4 py-6 text-center text-[14px] text-ink-500">{empty}</p>;
  const days = [...new Set(shown.map((item) => item.date))];
  const label = (date: string) => (date === today ? "Today" : today && date === addDays(today, 1) ? "Tomorrow" : dayText(date));
  return (
    <div className="divide-y divide-border-200">
      {days.map((date) => (
        <section key={date} aria-label={dayText(date)}>
          <h3 className={`flex items-center justify-between gap-2 bg-paper-100/60 px-4 py-1.5 text-[12px] font-semibold ${date === today ? "text-primary-700" : "text-ink-500"}`}>
            {dayBase ? (
              <Link href={`${dayBase}?view=day&date=${date}`} className="hover:underline">
                {label(date)}
              </Link>
            ) : (
              label(date)
            )}
            {dayBase && medCounts?.[date] ? (
              <Link href={`${dayBase}?view=day&date=${date}`} className="inline-flex items-center gap-1 font-medium text-primary-700 hover:underline">
                <Pill className="size-3.5" aria-hidden="true" /> {medCounts[date]} medicine{medCounts[date] === 1 ? "" : "s"}
              </Link>
            ) : null}
          </h3>
          <ul className="divide-y divide-border-200">
            {shown
              .filter((item) => item.date === date)
              .map((item) => (
                <li key={item.key} className="flex items-start gap-3 px-4 py-3">
                  <span className="w-20 shrink-0 pt-0.5 text-[12px] font-medium text-ink-500 tabular-nums">
                    {item.kind === "todo" ? <ListChecks className="size-4 text-ink-500" aria-label="Reminder due" /> : item.time}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 text-[15px] font-medium text-ink-900">
                      {item.title}
                      {item.repeats ? <Repeat className="size-3.5 text-ink-500" aria-label="Repeats" /> : null}
                    </span>
                    {item.location ? (
                      <span className="mt-0.5 flex items-center gap-1 text-[13px] text-ink-500">
                        <MapPin className="size-3.5" aria-hidden="true" /> {item.location}
                      </span>
                    ) : null}
                    {item.notes ? <span className="mt-0.5 block text-[13px] whitespace-pre-line text-ink-500">{item.notes}</span> : null}
                    <span className="mt-1 flex flex-wrap gap-1.5 text-[12px]">
                      {item.kind === "todo" ? <span className="rounded bg-paper-100 px-1.5 py-0.5 text-ink-500">Reminder</span> : null}
                      {item.who ? <span className="rounded bg-sky-100 px-1.5 py-0.5 font-medium text-primary-900">{item.kind === "todo" ? item.who : item.who === "You" ? "You’re going" : `${item.who} is going`}</span> : null}
                      {item.needsSomeone ? <span className="rounded bg-med-bg px-1.5 py-0.5 font-medium text-med-ink">Needs someone to go</span> : null}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5">
                    {item.canGo ? <GoButton circleId={circleId} id={item.id} /> : null}
                    {canEdit && item.kind === "event" ? (
                      <Link
                        href={`/circles/${circleId}/calendar/${item.id}`}
                        aria-label={`Edit ${item.title}`}
                        className="no-print inline-flex size-8 items-center justify-center rounded-md border border-border-200 bg-white text-ink-500 hover:bg-paper-100 hover:text-ink-900"
                      >
                        <Pencil className="size-3.5" aria-hidden="true" />
                      </Link>
                    ) : null}
                  </span>
                </li>
              ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
