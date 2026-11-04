import Link from "next/link";
import type { CalendarItem } from "@/lib/calendar-rows";
import { dayText, monthGrid } from "@/lib/schema/events";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** A month on one screen. Each day lists up to three items; a day can be tapped to add an event when allowed. */
export function MonthGrid({ month, items, circleId, canEdit }: { month: string; items: CalendarItem[]; circleId: string; canEdit: boolean }) {
  const weeks = monthGrid(month);
  return (
    <div className="overflow-hidden rounded-lg border border-border-200 bg-white">
      <div className="grid grid-cols-7 border-b border-border-200 bg-paper-100/60">
        {WEEKDAYS.map((day) => (
          <div key={day} className="px-2 py-1.5 text-[11px] font-semibold tracking-[0.08em] text-ink-500 uppercase">
            {day}
          </div>
        ))}
      </div>
      {weeks.map((week) => (
        <div key={week[0]} className="grid grid-cols-7 border-b border-border-200 last:border-b-0">
          {week.map((date) => {
            const dayItems = items.filter((item) => item.date === date);
            const inMonth = date.startsWith(month);
            return (
              <div key={date} className={`min-h-24 border-r border-border-200 p-1.5 last:border-r-0 ${inMonth ? "" : "bg-paper-100/40"}`}>
                <div className="flex items-center justify-between">
                  <span className={`text-[12px] tabular-nums ${inMonth ? "font-medium text-ink-900" : "text-ink-500/60"}`}>{Number(date.slice(8))}</span>
                  {canEdit && inMonth ? (
                    <Link
                      href={`/circles/${circleId}/calendar/new?date=${date}`}
                      aria-label={`Add an event on ${dayText(date)}`}
                      className="no-print rounded px-1 text-[13px] leading-none text-ink-500/60 hover:bg-paper-100 hover:text-primary-700"
                    >
                      +
                    </Link>
                  ) : null}
                </div>
                <ul className="mt-1 space-y-0.5">
                  {dayItems.slice(0, 3).map((item) => (
                    <li
                      key={item.key}
                      title={`${item.time} ${item.title}`}
                      className={`truncate rounded px-1 py-0.5 text-[11px] ${
                        item.kind === "todo" ? "bg-paper-100 text-ink-500" : item.needsSomeone ? "bg-med-bg text-med-ink" : "bg-sky-100 text-primary-900"
                      }`}
                    >
                      {item.kind === "event" && item.sortTime ? <span className="tabular-nums">{item.time.split(" to ")[0]} </span> : null}
                      {item.title}
                    </li>
                  ))}
                  {dayItems.length > 3 ? <li className="px-1 text-[11px] text-ink-500">+{dayItems.length - 3} more</li> : null}
                </ul>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
