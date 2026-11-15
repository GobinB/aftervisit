"use client";

import { Check, Copy, Link2, Pill, Power } from "lucide-react";
import { useState, useTransition } from "react";
import { setFeedMedicinesAction, startFeedAction, stopFeedAction } from "@/app/actions/calendar-feed";
import { subscribeLinks } from "@/lib/ics";

const big = "flex min-h-14 w-full items-center gap-3 rounded-xl border-2 px-4 text-left text-[16px] font-bold transition-colors";

/** What the calendar company receives when medicines are on. The privacy page says the same. */
const MEDICINES_SHARED =
  "With medicines on, Google, Apple or Microsoft receive each medicine's name, strength and times, and keep their own copy under their own privacy terms.";

/**
 * One-tap ways to add the circle's calendar to Google, Apple or Outlook, a switch for medicine
 * times, and ways to replace or turn off the link.
 */
export function CalendarLink({
  circleId,
  personName,
  initialUrl,
  initialIncludeMedicines,
}: {
  circleId: string;
  personName: string;
  initialUrl: string | null;
  initialIncludeMedicines: boolean;
}) {
  const [url, setUrl] = useState(initialUrl);
  const [meds, setMeds] = useState(initialIncludeMedicines);
  const [medsPending, startMeds] = useTransition();
  const [copied, setCopied] = useState(false);
  const [confirm, setConfirm] = useState<"new" | "off" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const name = `${personName}'s care`;

  const turnOn = () =>
    start(async () => {
      const result = await startFeedAction({ circleId });
      setConfirm(null);
      if (!result.ok) setError(result.error);
      else {
        setError(null);
        setUrl(result.url);
        setMeds(result.includeMedicines);
        setCopied(false);
      }
    });
  const switchMeds = () =>
    startMeds(async () => {
      const next = !meds;
      const result = await setFeedMedicinesAction({ circleId, include: next });
      if (!result.ok) setError(result.error);
      else {
        setError(null);
        setMeds(next);
      }
    });
  const turnOff = () =>
    start(async () => {
      const result = await stopFeedAction({ circleId });
      setConfirm(null);
      if (!result.ok) setError(result.error);
      else {
        setError(null);
        setUrl(null);
      }
    });

  if (!url) {
    return (
      <div className="max-w-xl space-y-4">
        <p className="text-[15px] text-ink-900">
          Turn on a private link, then add it to the calendar app you already use. Appointments, reminders and medicine times from this
          circle show up there and stay up to date.
        </p>
        <p className="text-[14px] text-ink-500">Medicines are on to start with. Once the link is on, you can leave them out before you add it to a calendar.</p>
        {error ? (
          <p role="alert" className="rounded-lg bg-attn-bg px-3 py-2 text-[14px] text-attn-ink">
            {error}
          </p>
        ) : null}
        <button type="button" disabled={pending} onClick={turnOn} className={`${big} border-primary-700 bg-primary-700 text-white hover:bg-primary-900 disabled:opacity-50`}>
          <Link2 className="size-6 shrink-0" aria-hidden="true" /> {pending ? "Turning on" : "Turn on the calendar link"}
        </button>
      </div>
    );
  }

  const links = subscribeLinks(url, name);
  return (
    <div className="max-w-xl space-y-5">
      <section aria-labelledby="meds-title" className="space-y-2 rounded-xl border border-border-200 bg-white p-4">
        <h2 id="meds-title" className="font-display text-[20px] text-primary-900">
          Medicines
        </h2>
        <button
          type="button"
          role="switch"
          aria-checked={meds}
          disabled={medsPending}
          onClick={switchMeds}
          className="flex min-h-14 w-full items-center gap-3 rounded-xl border-2 border-border-200 px-4 text-left hover:bg-paper-100 disabled:opacity-60"
        >
          <Pill className="size-6 shrink-0 text-primary-700" aria-hidden="true" />
          <span className="flex-1">
            <span className="block text-[16px] font-bold text-ink-900">Put medicine times in the calendar</span>
            <span className="block text-[13px] text-ink-500">
              {medsPending ? "Saving" : meds ? "On: each medicine shows at the times it is taken" : "Off: only appointments and reminders"}
            </span>
          </span>
          <span
            aria-hidden="true"
            className={`relative inline-flex h-8 w-14 shrink-0 items-center rounded-full transition-colors ${meds ? "bg-primary-700" : "bg-border-200"}`}
          >
            <span className={`inline-block size-6 rounded-full bg-white shadow transition-transform ${meds ? "translate-x-7" : "translate-x-1"}`} />
          </span>
        </button>
        <p className="text-[14px] text-ink-900">{MEDICINES_SHARED}</p>
      </section>

      <section aria-labelledby="add-title" className="space-y-2.5">
        <h2 id="add-title" className="font-display text-[20px] text-primary-900">
          Pick your calendar app
        </h2>
        <a href={links.google} target="_blank" rel="noreferrer" className={`${big} border-primary-700 bg-primary-700 text-white hover:bg-primary-900`}>
          <span className="flex-1">
            Google Calendar
            <span className="block text-[13px] font-medium text-white/80">Opens Google Calendar and asks to add it</span>
          </span>
        </a>
        <a href={links.apple} className={`${big} border-primary-700 bg-white text-primary-700 hover:bg-sky-100`}>
          <span className="flex-1">
            Apple Calendar
            <span className="block text-[13px] font-medium text-ink-500">iPhone, iPad and Mac: tap Subscribe</span>
          </span>
        </a>
        <a href={links.outlook} target="_blank" rel="noreferrer" className={`${big} border-primary-700 bg-white text-primary-700 hover:bg-sky-100`}>
          <span className="flex-1">Outlook</span>
        </a>
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(url);
              setCopied(true);
            } catch {
              setCopied(false);
            }
          }}
          className={`${big} border-border-200 bg-white text-ink-900 hover:bg-paper-100`}
        >
          {copied ? <Check className="size-6 shrink-0 text-ok" aria-hidden="true" /> : <Copy className="size-6 shrink-0" aria-hidden="true" />}
          <span className="flex-1">{copied ? "Link copied" : "Copy the link"}</span>
        </button>
        <p aria-live="polite" className="sr-only">
          {copied ? "Link copied." : ""}
        </p>
      </section>

      <div className="rounded-lg border border-sky-100 bg-sky-100/60 px-4 py-3 text-[14px] text-primary-900">
        <p className="font-semibold">Good to know</p>
        <ul className="mt-1 list-disc space-y-0.5 pl-5">
          <li>Anyone with this link can see what is in it, so only add it to your own calendar.</li>
          <li>Once added, Google, Apple or Microsoft keep a copy under their own privacy terms.</li>
          <li>The Calendar page here always shows the latest.</li>
        </ul>
      </div>

      <section aria-labelledby="soon-title" className="space-y-2">
        <h2 id="soon-title" className="font-display text-[20px] text-primary-900">
          How soon changes show
        </h2>
        <p className="text-[14px] text-ink-500">
          Your calendar app checks the link on its own schedule. A change made here, like a new time or a stopped medicine, shows there after
          its next check.
        </p>
        <dl className="divide-y divide-border-200 rounded-lg border border-border-200 bg-white text-[14px]">
          <div className="px-4 py-3">
            <dt className="font-semibold text-ink-900">Google Calendar</dt>
            <dd className="text-ink-900">Usually within 12 hours, sometimes up to a day. It cannot be hurried.</dd>
          </div>
          <div className="px-4 py-3">
            <dt className="font-semibold text-ink-900">Apple Calendar</dt>
            <dd className="text-ink-900">
              Usually within an hour. On a Mac, you pick how often when you subscribe: Every 15 minutes or Every hour works well.
            </dd>
          </div>
          <div className="px-4 py-3">
            <dt className="font-semibold text-ink-900">Outlook</dt>
            <dd className="text-ink-900">Usually within a few hours, sometimes up to a day.</dd>
          </div>
        </dl>
      </section>

      {error ? (
        <p role="alert" className="rounded-lg bg-attn-bg px-3 py-2 text-[14px] text-attn-ink">
          {error}
        </p>
      ) : null}

      {confirm ? (
        <div role="group" aria-label="Confirm" className="space-y-3 rounded-lg border border-border-200 bg-white p-4">
          <p className="text-[15px] text-ink-900">
            {confirm === "new"
              ? "The link you have now stops working, everywhere it was added. You then add the new one again. Make a new link?"
              : "The link stops working, and everything from it disappears from calendars it was added to at their next update. Turn it off?"}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={confirm === "new" ? turnOn : turnOff}
              className="inline-flex min-h-12 items-center rounded-lg border-2 border-attn bg-white px-4 text-[15px] font-semibold text-attn-ink hover:bg-attn-bg disabled:opacity-50"
            >
              {pending ? "Saving" : confirm === "new" ? "Yes, new link" : "Yes, turn it off"}
            </button>
            <button type="button" onClick={() => setConfirm(null)} className="inline-flex min-h-12 items-center rounded-lg px-4 text-[15px] font-semibold text-ink-500 hover:bg-paper-100">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setConfirm("new")}
            className="inline-flex min-h-12 items-center gap-2 rounded-lg border border-border-200 bg-white px-4 text-[15px] font-semibold text-primary-700 hover:bg-sky-100"
          >
            <Link2 className="size-5" aria-hidden="true" /> Make a new link
          </button>
          <button
            type="button"
            onClick={() => setConfirm("off")}
            className="inline-flex min-h-12 items-center gap-2 rounded-lg border border-border-200 bg-white px-4 text-[15px] font-semibold text-attn-ink hover:bg-attn-bg"
          >
            <Power className="size-5" aria-hidden="true" /> Turn off
          </button>
        </div>
      )}
    </div>
  );
}
