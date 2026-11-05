"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { deleteEventAction, saveEventAction } from "@/app/actions/events";
import { REPEATS, REPEAT_LABELS, type CareEvent, type Repeat } from "@/lib/schema/events";
import { localToday } from "@/lib/schema/todos";

const field = "mt-1 block h-10 w-full rounded-md border border-border-200 bg-white px-3 text-[14px] text-ink-900";
const label = "block text-[13px] font-medium text-ink-900";

/** Add or edit an event. Only what it is and the date are needed. */
export function EventForm({
  circleId,
  people,
  event,
  initialDate,
  canDelete,
  isCaregiver,
}: {
  circleId: string;
  people: { value: string; label: string }[];
  event?: CareEvent;
  initialDate?: string;
  canDelete: boolean;
  isCaregiver: boolean;
}) {
  const id = useId();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState(event?.title ?? "");
  const [date, setDate] = useState(event?.date ?? initialDate ?? "");
  const [allDay, setAllDay] = useState(event ? !event.startTime : false);
  const [startTime, setStartTime] = useState(event?.startTime ?? "09:00");
  const [endTime, setEndTime] = useState(event?.endTime ?? "");
  const [location, setLocation] = useState(event?.location ?? "");
  const [notes, setNotes] = useState(event?.notes ?? "");
  const [repeat, setRepeat] = useState<Repeat>(event?.repeat ?? "none");
  const [repeatUntil, setRepeatUntil] = useState(event?.repeatUntil ?? "");
  const initialGoing = event?.going ? (event.going.kind === "caregiver" ? "caregiver" : event.going.memberId) : event?.needsVolunteer ? "volunteer" : "none";
  const [going, setGoing] = useState(initialGoing);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    start(async () => {
      const result = await saveEventAction({
        circleId,
        ...(event ? { id: event.id } : {}),
        title,
        date: date || localToday(),
        startTime: allDay ? "" : startTime,
        endTime: allDay ? "" : endTime,
        location,
        notes,
        repeat,
        repeatUntil: repeat === "none" ? "" : repeatUntil,
        going,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(`/circles/${circleId}/calendar`);
      router.refresh();
    });
  };

  const remove = () => {
    if (!event || !window.confirm(`Delete "${event.title}"${event.repeat !== "none" ? " and every time it repeats" : ""}? This cannot be undone.`)) return;
    start(async () => {
      const result = await deleteEventAction({ circleId, id: event.id });
      if (!result.ok) setError(result.error);
      else {
        router.push(`/circles/${circleId}/calendar`);
        router.refresh();
      }
    });
  };

  return (
    <form onSubmit={submit} className="max-w-2xl space-y-5 rounded-lg border border-border-200 bg-white p-4 sm:p-5" noValidate>
      <div>
        <label htmlFor={`${id}-title`} className={label}>
          What
        </label>
        <input id={`${id}-title`} className={field} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} placeholder="Cardiology appointment" />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor={`${id}-date`} className={label}>
            Date
          </label>
          <input id={`${id}-date`} type="date" className={field} value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        {!allDay ? (
          <>
            <div>
              <label htmlFor={`${id}-start`} className={label}>
                Starts
              </label>
              <input id={`${id}-start`} type="time" className={field} value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
            <div>
              <label htmlFor={`${id}-end`} className={label}>
                Ends <span className="font-normal text-ink-500">(optional)</span>
              </label>
              <input id={`${id}-end`} type="time" className={field} value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
          </>
        ) : null}
      </div>
      <label className="flex items-center gap-2 text-[14px] text-ink-900">
        <input type="checkbox" className="size-4 accent-primary-700" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} /> All day
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={`${id}-where`} className={label}>
            Where
          </label>
          <input id={`${id}-where`} className={field} value={location} onChange={(e) => setLocation(e.target.value)} maxLength={300} placeholder="Riverbend Clinic, 2nd floor" />
        </div>
        <div>
          <label htmlFor={`${id}-who`} className={label}>
            Who&apos;s going
          </label>
          <select id={`${id}-who`} className={field} value={going} onChange={(e) => setGoing(e.target.value)}>
            <option value="none">Not needed</option>
            <option value="volunteer">Needs someone to go</option>
            <option value="caregiver">{isCaregiver ? "Me" : "The caregiver"}</option>
            {people.map((person) => (
              <option key={person.value} value={person.value}>
                {person.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={`${id}-repeat`} className={label}>
            Repeats
          </label>
          <select id={`${id}-repeat`} className={field} value={repeat} onChange={(e) => setRepeat(e.target.value as Repeat)}>
            {REPEATS.map((value) => (
              <option key={value} value={value}>
                {REPEAT_LABELS[value]}
              </option>
            ))}
          </select>
        </div>
        {repeat !== "none" ? (
          <div>
            <label htmlFor={`${id}-until`} className={label}>
              Until <span className="font-normal text-ink-500">(optional)</span>
            </label>
            <input id={`${id}-until`} type="date" className={field} value={repeatUntil} onChange={(e) => setRepeatUntil(e.target.value)} />
          </div>
        ) : null}
      </div>

      <div>
        <label htmlFor={`${id}-notes`} className={label}>
          Notes
        </label>
        <textarea
          id={`${id}-notes`}
          rows={2}
          className="mt-1 block w-full rounded-md border border-border-200 bg-white px-3 py-2 text-[14px] text-ink-900"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={1000}
          placeholder="Bring the medication list and insurance card"
        />
      </div>

      {error ? (
        <p role="alert" className="rounded-md bg-attn-bg px-3 py-2 text-[13px] text-attn-ink">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" disabled={pending} className="inline-flex h-10 items-center rounded-md bg-primary-700 px-4 text-[14px] font-semibold text-white hover:bg-primary-900 disabled:opacity-50">
          {pending ? "Saving" : "Save event"}
        </button>
        <Link href={`/circles/${circleId}/calendar`} className="inline-flex h-10 items-center rounded-md px-3 text-[14px] font-medium text-ink-500 hover:text-ink-900">
          Cancel
        </Link>
        {event && canDelete ? (
          <button type="button" onClick={remove} disabled={pending} className="ml-auto inline-flex h-10 items-center rounded-md px-3 text-[14px] font-medium text-attn-ink hover:bg-attn-bg">
            Delete
          </button>
        ) : null}
      </div>
    </form>
  );
}
