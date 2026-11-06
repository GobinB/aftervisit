"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { dayText } from "@/lib/schema/events";
import { localToday } from "@/lib/schema/todos";
import { KIND_LABELS, type Week, type WeekBlock, type WeekKind } from "@/lib/week-layout";

/** Height of one hour, in pixels. */
const HOUR = 60;
const LABEL_COL = 56;

/** Soft fill and a stronger edge, one colour per kind. Text always stays dark ink, so it reads. */
export const KIND_STYLE: Record<WeekKind, string> = {
  event: "border-primary-700/70 bg-sky-100",
  needs: "border-heart-500 bg-[#FCEDEA]",
  reminder: "border-med/70 bg-med-bg",
  meds: "border-ok/70 bg-ok-bg",
};

const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function hourLabel(hour: number): string {
  if (hour === 0 || hour === 24) return "12 AM";
  if (hour === 12) return "Noon";
  return hour < 12 ? `${hour} AM` : `${hour - 12} PM`;
}

/** The colour key above the grid. */
export function WeekKey({ kinds }: { kinds: WeekKind[] }) {
  return (
    <ul aria-label="Colour key" className="flex flex-wrap items-center gap-1.5">
      <li className="mr-1 text-[12px] font-semibold text-ink-500">Key</li>
      {kinds.map((kind) => (
        <li key={kind} className={`rounded-full border-[1.5px] px-2.5 py-0.5 text-[12px] font-medium text-ink-900 ${KIND_STYLE[kind]}`}>
          {KIND_LABELS[kind]}
        </li>
      ))}
    </ul>
  );
}

function Block({ block, startHour }: { block: WeekBlock; startHour: number }) {
  const top = ((block.start - startHour * 60) / 60) * HOUR;
  const height = Math.max(26, ((block.end - block.start) / 60) * HOUR - 3);
  const short = height < 44;
  const width = 100 / block.lanes;
  const body = (
    <>
      <span className={`block font-semibold text-ink-900 ${short ? "truncate" : "line-clamp-2"} text-[13px] leading-[16px]`}>{block.title}</span>
      {block.detail && !short ? <span className="mt-0.5 block truncate text-[12px] leading-[15px] text-ink-500">{block.detail}</span> : null}
    </>
  );
  const box = `absolute overflow-hidden rounded-lg border-[1.5px] px-1.5 py-1 shadow-[0_1px_0_rgb(0_0_0/0.04)] ${KIND_STYLE[block.kind]}`;
  const style = { top, height, left: `calc(${block.lane * width}% + 2px)`, width: `calc(${width}% - 4px)` };
  const label = `${block.title}, ${dayText(block.date)}, ${block.detail}`;
  return block.href ? (
    <Link href={block.href} className={`${box} hover:brightness-[0.97] focus-visible:z-10`} style={style} aria-label={label}>
      {body}
    </Link>
  ) : (
    <div className={box} style={style} aria-label={label}>
      {body}
    </div>
  );
}

/**
 * A week as a time grid: hours down the side, a column per day, each appointment, reminder and
 * time for medicines as a coloured card. On a phone the days scroll sideways and open on today.
 */
export function WeekGrid({ week, base, canEdit }: { week: Week; base: string; canEdit: boolean }) {
  const scroller = useRef<HTMLDivElement>(null);
  const [today, setToday] = useState<string | null>(null);
  const [now, setNow] = useState<number | null>(null);
  const hours = Array.from({ length: week.endHour - week.startHour }, (_, i) => week.startHour + i);
  const height = hours.length * HOUR;
  const hasAllDay = week.days.some((d) => week.allDay[d].length);

  useEffect(() => {
    const t = localToday();
    setToday(t);
    const d = new Date();
    setNow(d.getHours() * 60 + d.getMinutes());
    const index = week.days.indexOf(t);
    const el = scroller.current;
    if (el && index > 0) {
      const column = el.querySelector<HTMLElement>(`[data-day="${t}"]`);
      if (column) el.scrollLeft = Math.max(0, column.offsetLeft - LABEL_COL);
    }
  }, [week.days]);

  const cols = { gridTemplateColumns: `${LABEL_COL}px repeat(7, minmax(128px, 1fr))` };
  return (
    <div ref={scroller} className="overflow-x-auto rounded-lg border border-border-200 bg-white [scrollbar-width:thin]">
      <div className="min-w-[952px] lg:min-w-0">
        {/* Day names */}
        <div className="grid border-b border-border-200 bg-paper-100" style={cols}>
          {/* The hour column stays put while the days slide sideways on a phone. */}
          <div className="sticky left-0 z-20 bg-paper-100" />
          {week.days.map((date) => {
            const isToday = date === today;
            const n = Number(date.slice(8));
            return (
              <div key={date} data-day={date} className="flex items-center justify-between gap-1 border-l border-border-200 px-2 py-2">
                <Link href={`${base}?view=day&date=${date}`} className="flex items-center gap-1.5 rounded-md hover:underline" aria-label={`${dayText(date)}${isToday ? ", today" : ""}`}>
                  <span className={`text-[12px] font-semibold uppercase ${isToday ? "text-primary-700" : "text-ink-500"}`}>{WEEKDAY[new Date(`${date}T12:00:00Z`).getUTCDay()]}</span>
                  <span
                    className={`inline-flex size-8 items-center justify-center rounded-full text-[16px] font-bold tabular-nums ${
                      isToday ? "bg-primary-700 text-white" : "text-ink-900"
                    }`}
                  >
                    {n}
                  </span>
                </Link>
                {canEdit ? (
                  <Link
                    href={`${base}/new?date=${date}`}
                    aria-label={`Add an event on ${dayText(date)}`}
                    className="no-print inline-flex size-8 items-center justify-center rounded-md text-ink-500 hover:bg-white hover:text-primary-700"
                  >
                    <Plus className="size-4" aria-hidden="true" />
                  </Link>
                ) : null}
              </div>
            );
          })}
        </div>

        {/* Reminders, all-day events and medicines with no set time */}
        {hasAllDay ? (
          <div className="grid border-b border-border-200" style={cols}>
            <div className="sticky left-0 z-20 bg-white px-1.5 py-2 text-right text-[11px] font-semibold text-ink-500 uppercase">All day</div>
            {week.days.map((date) => (
              <ul key={date} className={`space-y-1 border-l border-border-200 p-1 ${date === today ? "bg-sky-100/30" : ""}`} aria-label={`${dayText(date)}, all day`}>
                {week.allDay[date].map((item) => {
                  const inner = (
                    <>
                      <span className="block truncate text-[13px] font-semibold text-ink-900">{item.title}</span>
                      {item.detail ? <span className="block truncate text-[12px] text-ink-500">{item.detail}</span> : null}
                    </>
                  );
                  const cls = `block rounded-lg border-[1.5px] px-1.5 py-1 ${KIND_STYLE[item.kind]}`;
                  return (
                    <li key={item.key}>
                      {item.href ? (
                        <Link href={item.href} className={`${cls} hover:brightness-[0.97]`}>
                          {inner}
                        </Link>
                      ) : (
                        <div className={cls}>{inner}</div>
                      )}
                    </li>
                  );
                })}
              </ul>
            ))}
          </div>
        ) : null}

        {/* The hours */}
        <div className="grid" style={cols}>
          <div className="sticky left-0 z-20 bg-white" style={{ height }} aria-hidden="true">
            {hours.map((hour, i) => (
              <span key={hour} className="absolute right-2 -translate-y-1/2 text-[11px] font-medium text-ink-500 tabular-nums" style={{ top: i === 0 ? 8 : i * HOUR }}>
                {hourLabel(hour)}
              </span>
            ))}
          </div>
          {week.days.map((date) => (
            <section
              key={date}
              aria-label={dayText(date)}
              className={`relative border-l border-border-200 ${date === today ? "bg-sky-100/30" : ""}`}
              style={{
                height,
                backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent ${HOUR - 1}px, var(--color-border-200) ${HOUR - 1}px, var(--color-border-200) ${HOUR}px)`,
              }}
            >
              {date === today && now !== null && now >= week.startHour * 60 && now <= week.endHour * 60 ? (
                <div className="pointer-events-none absolute inset-x-0 z-10 flex items-center" style={{ top: ((now - week.startHour * 60) / 60) * HOUR }} aria-hidden="true">
                  <span className="-ml-1 size-2.5 rounded-full bg-heart-500" />
                  <span className="h-0.5 flex-1 bg-heart-500" />
                </div>
              ) : null}
              {week.timed[date].map((block) => (
                <Block key={block.key} block={block} startHour={week.startHour} />
              ))}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
