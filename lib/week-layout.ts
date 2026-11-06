import type { CalendarItem } from "@/lib/calendar-rows";
import { medsByTime, type MedDose } from "@/lib/med-days";
import { addDays, dayText } from "@/lib/schema/events";
import { clockTime } from "@/lib/schema/medications";

/**
 * The week view: a time grid, one column per day, with every block placed by its start and end.
 * Colours by kind, like a conference schedule: appointments, appointments that need someone to go,
 * reminders that are due, and the medicines for each time of day.
 */
export type WeekKind = "event" | "needs" | "reminder" | "meds";

export type WeekBlock = {
  key: string;
  kind: WeekKind;
  date: string;
  title: string;
  detail: string;
  /** Minutes after midnight. */
  start: number;
  end: number;
  /** Side-by-side position when blocks overlap: lane of lanes. */
  lane: number;
  lanes: number;
  href: string | null;
};

export type AllDayItem = { key: string; kind: WeekKind; date: string; title: string; detail: string; href: string | null };

export type Week = {
  days: string[];
  timed: Record<string, WeekBlock[]>;
  allDay: Record<string, AllDayItem[]>;
  startHour: number;
  endHour: number;
};

export const KIND_LABELS: Record<WeekKind, string> = {
  event: "Appointment",
  needs: "Needs someone to go",
  reminder: "Reminder due",
  meds: "Medicines",
};

const DEFAULT_START = 7;
const DEFAULT_END = 20;
/** An event with a start and no end is drawn as an hour; a time for medicines as half an hour. */
const EVENT_MINUTES = 60;
const MEDS_MINUTES = 30;

/** The Sunday that starts the week holding `iso` (weeks run Sunday to Saturday, as in the month grid). */
export function weekStart(iso: string): string {
  const day = new Date(`${iso}T12:00:00Z`).getUTCDay();
  return addDays(iso, -day);
}

export function weekDays(start: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/** "Nov 1 – 7, 2026", or "Oct 29 – Nov 4, 2026" across months. */
export function weekText(start: string): string {
  const end = addDays(start, 6);
  const [, a] = dayText(start).split(", ");
  const [, b] = dayText(end).split(", ");
  const sameMonth = start.slice(0, 7) === end.slice(0, 7);
  return `${a} – ${sameMonth ? b.split(" ")[1] : b}, ${end.slice(0, 4)}`;
}

const minutes = (clock: string) => {
  const [h, m] = clock.split(":").map(Number);
  return h * 60 + m;
};

/** Gives overlapping blocks their own lanes, each group of overlaps sharing the column's width. */
export function placeLanes(blocks: Omit<WeekBlock, "lane" | "lanes">[]): WeekBlock[] {
  const sorted = [...blocks].sort((a, b) => a.start - b.start || b.end - a.end);
  const out: WeekBlock[] = [];
  let group: WeekBlock[] = [];
  let groupEnd = -1;
  const close = () => {
    const lanes = Math.max(1, ...group.map((block) => block.lane + 1));
    for (const block of group) out.push({ ...block, lanes });
    group = [];
  };
  for (const block of sorted) {
    if (group.length && block.start >= groupEnd) close();
    const taken = new Set(group.filter((other) => other.end > block.start).map((other) => other.lane));
    let lane = 0;
    while (taken.has(lane)) lane++;
    group.push({ ...block, lane, lanes: 1 });
    groupEnd = Math.max(groupEnd, block.end);
  }
  if (group.length) close();
  return out;
}

/**
 * Lays out a week. `items` are the calendar's events and due reminders; `meds` the medicines due
 * each day. Hours run 7 AM to 8 PM unless something falls outside them.
 */
export function buildWeek({
  start,
  items,
  meds = {},
  base,
  canEdit,
}: {
  start: string;
  items: CalendarItem[];
  meds?: Record<string, MedDose[]>;
  base: string;
  canEdit: boolean;
}): Week {
  const days = weekDays(start);
  const timed: Record<string, Omit<WeekBlock, "lane" | "lanes">[]> = Object.fromEntries(days.map((d) => [d, []]));
  const allDay: Record<string, AllDayItem[]> = Object.fromEntries(days.map((d) => [d, []]));
  const dayHref = (date: string) => `${base}?view=day&date=${date}`;

  for (const item of items) {
    if (!timed[item.date]) continue;
    if (item.kind === "todo") {
      allDay[item.date].push({ key: item.key, kind: "reminder", date: item.date, title: item.title, detail: item.who ?? "Reminder due", href: `${base.replace(/\/calendar$/, "")}/todos` });
      continue;
    }
    const kind: WeekKind = item.needsSomeone ? "needs" : "event";
    const href = canEdit ? `${base}/${item.id}` : dayHref(item.date);
    const detail = [item.needsSomeone ? "Needs someone" : item.who ? `${item.who} going` : null, item.location].filter(Boolean).join(" · ");
    if (!item.startTime) {
      allDay[item.date].push({ key: item.key, kind, date: item.date, title: item.title, detail, href });
      continue;
    }
    const begin = minutes(item.startTime);
    const end = item.endTime ? Math.max(minutes(item.endTime), begin + 15) : begin + EVENT_MINUTES;
    timed[item.date].push({ key: item.key, kind, date: item.date, title: item.title, detail: [item.time, detail].filter(Boolean).join(" · "), start: begin, end: Math.min(end, 24 * 60), href });
  }

  for (const date of days) {
    for (const slot of medsByTime(meds[date] ?? [])) {
      const title = slot.meds.map((med) => med.name).join(", ");
      const detail = `${slot.meds.length} medicine${slot.meds.length === 1 ? "" : "s"}`;
      if (!slot.time) {
        allDay[date].push({ key: `meds-${date}-any`, kind: "meds", date, title, detail: `${detail}, any time`, href: dayHref(date) });
        continue;
      }
      const begin = minutes(slot.time);
      timed[date].push({ key: `meds-${date}-${slot.time}`, kind: "meds", date, title, detail: `${clockTime(slot.time)} · ${detail}`, start: begin, end: Math.min(begin + MEDS_MINUTES, 24 * 60), href: dayHref(date) });
    }
  }

  const all = days.flatMap((d) => timed[d]);
  const startHour = Math.max(0, Math.min(DEFAULT_START, ...all.map((b) => Math.floor(b.start / 60))));
  const endHour = Math.min(24, Math.max(DEFAULT_END, ...all.map((b) => Math.ceil(b.end / 60))));
  return {
    days,
    timed: Object.fromEntries(days.map((d) => [d, placeLanes(timed[d])])),
    allDay,
    startHour,
    endHour,
  };
}
