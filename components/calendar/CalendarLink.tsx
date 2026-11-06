"use client";

import { Check, Copy, Link2, Power } from "lucide-react";
import { useState, useTransition } from "react";
import { startFeedAction, stopFeedAction } from "@/app/actions/calendar-feed";
import { subscribeLinks } from "@/lib/ics";

const big = "flex min-h-14 w-full items-center gap-3 rounded-xl border-2 px-4 text-left text-[16px] font-bold transition-colors";

/** One-tap ways to add the circle's calendar to Google, Apple or Outlook, and to replace or turn off the link. */
export function CalendarLink({ circleId, personName, initialUrl }: { circleId: string; personName: string; initialUrl: string | null }) {
  const [url, setUrl] = useState(initialUrl);
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
        setCopied(false);
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
          Turn on a private link, then add it to the calendar app you already use. Appointments and reminders from this circle show up
          there and stay up to date. Medicines are left out.
        </p>
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
          <li>Changes reach Apple Calendar within about an hour. Google Calendar can take up to a day.</li>
          <li>Anyone with this link can see the appointments and reminders, so only add it to your own calendar.</li>
          <li>Once added, Google, Apple or Microsoft keep a copy under their own privacy terms.</li>
        </ul>
      </div>

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
              : "The link stops working, and the appointments disappear from calendars it was added to at their next update. Turn it off?"}
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
