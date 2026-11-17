"use client";

import { Check, Copy, Loader2, MessageSquare } from "lucide-react";
import { useEffect, useState } from "react";
import { markToldAction, memberLinkAction } from "@/app/actions/members";
import { memberUrl } from "@/components/circles/member-link";
import { assignedMessage, assignedSummary, smsTo, type Assigned } from "@/lib/share-message";

/** A person who was put down for something on this visit, or added on this page. */
export type TellPerson = { memberId: string; name: string; phone: string | null; isNew: boolean; token?: string; assigned: Assigned };

type Link = { url: string; hasPin: boolean } | { error: string };

const firstName = (name: string) => name.trim().split(/\s+/)[0] || name.trim();

/**
 * Right after a visit updates the circle: one row per person who was put down for something (or
 * added), with their message ready to text. The app sends nothing itself; Text opens the phone's
 * Messages app with the number and the message filled in.
 */
export function TellHelpers({ circleId, personName, people }: { circleId: string; personName: string; people: TellPerson[] }) {
  const [links, setLinks] = useState<Record<string, Link>>(() =>
    Object.fromEntries(people.filter((person) => person.token).map((person) => [person.memberId, { url: memberUrl(person.token!), hasPin: false }])),
  );
  const [sent, setSent] = useState<Record<string, "texted" | "copied">>({});
  // People whose message could not be copied; their message is shown to select and copy by hand.
  const [byHand, setByHand] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancel = false;
    // Someone already in the circle keeps the link they have; it is looked up here, before any tap, so Text is a plain link.
    for (const person of people.filter((item) => !item.token)) {
      memberLinkAction({ circleId, memberId: person.memberId })
        .then((result) => {
          if (cancel) return;
          setLinks((all) => ({ ...all, [person.memberId]: result.ok ? { url: memberUrl(result.token), hasPin: result.hasPin } : { error: result.error } }));
        })
        .catch(() => {
          if (!cancel) setLinks((all) => ({ ...all, [person.memberId]: { error: "Their link could not be loaded. Find them on People." } }));
        });
    }
    return () => {
      cancel = true;
    };
  }, [circleId, people]);

  if (!people.length) return null;

  function told(memberId: string, how: "texted" | "copied") {
    setSent((all) => ({ ...all, [memberId]: how }));
    markToldAction({ circleId, memberIds: [memberId] }).catch(() => undefined);
  }

  async function copy(memberId: string, body: string) {
    try {
      if (!navigator.clipboard) throw new Error("No clipboard here");
      await navigator.clipboard.writeText(body);
      setByHand((all) => ({ ...all, [memberId]: false }));
      told(memberId, "copied");
    } catch {
      setByHand((all) => ({ ...all, [memberId]: true }));
    }
  }

  return (
    <section aria-labelledby="tell-helpers-title" className="rounded-lg border border-primary-700/25 bg-sky-100/60 p-4">
      <h2 id="tell-helpers-title" className="text-name font-semibold text-primary-900">
        Text each person what they are down for
      </h2>
      <p className="mt-0.5 text-note text-ink-900">The message has their own link. It says when, and keeps the health details behind the link.</p>
      <ul className="mt-3 divide-y divide-border-200 rounded-lg border border-border-200 bg-white">
        {people.map((person) => {
          const link = links[person.memberId];
          const body = link && "url" in link ? assignedMessage({ name: person.name, personName, url: link.url, isNew: person.isNew, hasPin: link.hasPin, assigned: person.assigned }) : null;
          const first = firstName(person.name);
          const summary = assignedSummary(person.assigned);
          return (
            <li key={person.memberId} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-3 py-3">
              <div className="min-w-0">
                <p className="text-name font-semibold text-ink-900">
                  {person.name}
                  {person.isNew ? <span className="ml-2 rounded-full bg-sky-100 px-2 py-0.5 text-badge font-semibold text-primary-700">New</span> : null}
                </p>
                <p className="text-hint text-ink-500">
                  {summary || "Added to the circle"}
                  {person.phone ? ` · ${person.phone}` : ""}
                </p>
                {link && "error" in link ? (
                  <p role="alert" className="mt-1 text-hint text-attn-ink">
                    {link.error}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {sent[person.memberId] ? (
                  <span role="status" className="inline-flex items-center gap-1 text-note font-semibold text-ok-ink">
                    <Check className="size-4" aria-hidden="true" /> {sent[person.memberId] === "texted" ? "Text opened" : "Copied"}
                  </span>
                ) : null}
                {body ? (
                  <>
                    <a
                      href={smsTo(person.phone, body)}
                      onClick={() => told(person.memberId, "texted")}
                      className="inline-flex min-h-12 items-center gap-2 rounded-lg bg-primary-700 px-4 text-label font-semibold text-white hover:bg-primary-900"
                    >
                      <MessageSquare className="size-4" aria-hidden="true" /> Text {first}
                    </a>
                    <button
                      type="button"
                      aria-label={`Copy the message for ${first}`}
                      onClick={() => copy(person.memberId, body)}
                      className="inline-flex min-h-12 items-center gap-2 rounded-lg border border-border-200 bg-white px-4 text-label font-semibold text-primary-700 hover:bg-sky-100"
                    >
                      <Copy className="size-4" aria-hidden="true" /> Copy
                    </button>
                  </>
                ) : !link ? (
                  <Loader2 className="size-5 animate-spin text-ink-500" aria-label={`Getting ${first}'s link`} />
                ) : null}
              </div>
              {body && byHand[person.memberId] ? (
                <div className="basis-full">
                  <p role="alert" className="text-note text-attn-ink">
                    Copying did not work on this device. Select the message below and copy it yourself.
                  </p>
                  <textarea
                    readOnly
                    value={body}
                    rows={8}
                    aria-label={`The message for ${first}`}
                    onFocus={(event) => event.currentTarget.select()}
                    className="mt-1 w-full rounded-lg border border-border-200 bg-surface-50 p-3 text-label text-ink-900 outline-none focus:border-action-500"
                  />
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
