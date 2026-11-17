"use client";

import { Check, Copy, Link2, Loader2, Mail, MessageSquare } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { currentMemberLinkAction, markToldAction, memberLinkAction, pendingUpdatesAction } from "@/app/actions/members";
import { memberUrl } from "@/components/circles/member-link";
import { changedWords } from "@/lib/link-life";
import { assignedMessage, assignedSummary, mailTo, shareMessage, smsTo, type Assigned } from "@/lib/share-message";

/** A person put down for something on this visit, or added on Update. */
export type TellPerson = { memberId: string; name: string; phone: string | null; isNew: boolean; token?: string; assigned: Assigned };

/** Everyone on the list: those put down for something first, then anyone else who has not seen the changes. */
type Row = { memberId: string; name: string; phone: string | null; isNew: boolean; token?: string; assigned: Assigned | null; changed: string | null };

/** Their link (and email, when the circle has one); an older link only a tap may replace (it stops the old one working); or why it could not be loaded. */
type LinkState = { url: string; hasPin: boolean; email: string | null; replaced?: boolean } | { old: string } | { error: string };

const firstName = (name: string) => name.trim().split(/\s+/)[0] || name.trim();

const action = "inline-flex min-h-[48px] items-center justify-center gap-1.5 rounded-lg px-3 text-label font-semibold";

/**
 * The end of a visit: every person who should hear about it, each with their own link on screen and
 * three ways to send it: Text (the phone's Messages app, number and message filled in), Email (the
 * mail app, the same) and Copy link. The app sends nothing itself. Links load by themselves, so
 * there is nothing to tap first; an older link is only replaced on a tap, since that stops it working.
 */
export function SendLinks({ circleId, personName, people }: { circleId: string; personName: string; people: TellPerson[] }) {
  const [others, setOthers] = useState<Row[]>([]);
  const [links, setLinks] = useState<Record<string, LinkState>>(() =>
    Object.fromEntries(people.filter((person) => person.token).map((person) => [person.memberId, { url: memberUrl(person.token!), hasPin: false, email: null }])),
  );
  const [sent, setSent] = useState<Record<string, "texted" | "emailed" | "copied">>({});
  // Where copying is blocked, the link on screen is there to press and hold.
  const [copyFailed, setCopyFailed] = useState<Record<string, boolean>>({});
  const [making, setMaking] = useState<string | null>(null);

  // Anyone else who can see what changed and has not heard yet.
  useEffect(() => {
    let cancel = false;
    pendingUpdatesAction(circleId)
      .then((list) => {
        if (cancel) return;
        const skip = new Set(people.map((person) => person.memberId));
        setOthers(
          list
            .filter((person) => !skip.has(person.memberId))
            .map((person) => ({ memberId: person.memberId, name: person.name, phone: null, isNew: false, assigned: null, changed: changedWords(person.areas) })),
        );
      })
      .catch(() => undefined);
    return () => {
      cancel = true;
    };
  }, [circleId, people]);

  const rows: Row[] = useMemo(() => [...people.map((person) => ({ ...person, changed: null })), ...others], [people, others]);

  // Each existing person's current link, looked up once, before any tap. Looking it up never replaces an older link.
  const asked = useRef(new Set<string>());
  useEffect(() => {
    for (const row of rows.filter((item) => !item.token && !asked.current.has(item.memberId))) {
      asked.current.add(row.memberId);
      currentMemberLinkAction({ circleId, memberId: row.memberId })
        .then((result) => {
          const link: LinkState = result.ok
            ? { url: memberUrl(result.token), hasPin: result.hasPin, email: result.email }
            : "oldLink" in result
              ? { old: result.error }
              : { error: result.error };
          setLinks((all) => ({ ...all, [row.memberId]: link }));
        })
        .catch(() => setLinks((all) => ({ ...all, [row.memberId]: { error: "Their link could not be loaded. Find them on People." } })));
    }
  }, [circleId, rows]);

  if (!rows.length) return null;

  function told(memberId: string, how: "texted" | "emailed" | "copied") {
    setSent((all) => ({ ...all, [memberId]: how }));
    markToldAction({ circleId, memberIds: [memberId] }).catch(() => undefined);
  }

  /** Replaces an older link with one that can be sent; the old one stops working. Only on a tap. */
  async function makeLink(memberId: string) {
    setMaking(memberId);
    try {
      const result = await memberLinkAction({ circleId, memberId });
      setLinks((all) => ({ ...all, [memberId]: result.ok ? { url: memberUrl(result.token), hasPin: result.hasPin, email: result.email, replaced: true } : { error: result.error } }));
    } catch {
      setLinks((all) => ({ ...all, [memberId]: { error: "Their link could not be made. Check your connection and try again." } }));
    } finally {
      setMaking(null);
    }
  }

  async function copy(memberId: string, url: string) {
    try {
      if (!navigator.clipboard) throw new Error("No clipboard here");
      await navigator.clipboard.writeText(url);
      setCopyFailed((all) => ({ ...all, [memberId]: false }));
      told(memberId, "copied");
    } catch {
      setCopyFailed((all) => ({ ...all, [memberId]: true }));
    }
  }

  /** The message: what they are down for, or what changed; their link; nothing about health in the text itself. */
  function message(row: Row, link: Extract<LinkState, { url: string }>): { subject: string; body: string } {
    if (row.assigned) {
      return {
        subject: `${personName}'s care circle`,
        body: assignedMessage({ name: row.name, personName, url: link.url, isNew: row.isNew, hasPin: link.hasPin, newLink: link.replaced, assigned: row.assigned }),
      };
    }
    return shareMessage({ name: row.name, personName, url: link.url, hasPin: link.hasPin, changed: row.changed ?? undefined });
  }

  return (
    <section aria-labelledby="send-links-title">
      <h2 id="send-links-title" className="text-name font-semibold text-primary-900">
        Send each person their link
      </h2>
      <ul className="mt-2 divide-y divide-border-200 rounded-lg border border-border-200 bg-white">
        {rows.map((row) => {
          const link = links[row.memberId];
          const ready = link && "url" in link ? link : null;
          const msg = ready ? message(row, ready) : null;
          const first = firstName(row.name);
          const what = row.assigned ? assignedSummary(row.assigned) || "Added to the circle" : "Has not seen the changes yet";
          return (
            <li key={row.memberId} className="px-3 py-3">
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <p className="text-name font-semibold text-ink-900">
                  {row.name}
                  {row.isNew ? <span className="ml-2 rounded-full bg-sky-100 px-2 py-0.5 text-badge font-semibold text-primary-700">New</span> : null}
                </p>
                {sent[row.memberId] ? (
                  <span role="status" className="inline-flex items-center gap-1 text-note font-semibold text-ok-ink">
                    <Check className="size-4" aria-hidden="true" /> {sent[row.memberId] === "texted" ? "Text opened" : sent[row.memberId] === "emailed" ? "Email opened" : "Link copied"}
                  </span>
                ) : null}
              </div>
              <p className="text-hint text-ink-500">
                {what}
                {row.phone ? ` · ${row.phone}` : ""}
              </p>

              {ready && msg ? (
                <>
                  <input
                    readOnly
                    value={ready.url}
                    aria-label={`${first}'s link`}
                    onFocus={(event) => event.currentTarget.select()}
                    className="mt-2 w-full truncate rounded-md border border-border-200 bg-surface-50 px-2.5 py-2 text-note text-ink-900 outline-none focus:border-action-500"
                  />
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    <a href={smsTo(row.phone, msg.body)} onClick={() => told(row.memberId, "texted")} className={`${action} bg-primary-700 text-white hover:bg-primary-900`}>
                      <MessageSquare className="size-4 shrink-0" aria-hidden="true" /> Text<span className="sr-only"> {first}</span>
                    </a>
                    <a
                      href={mailTo(ready.email, msg.subject, msg.body)}
                      onClick={() => told(row.memberId, "emailed")}
                      className={`${action} border border-primary-700 bg-white text-primary-700 hover:bg-sky-100`}
                    >
                      <Mail className="size-4 shrink-0" aria-hidden="true" /> Email<span className="sr-only"> {first}</span>
                    </a>
                    <button type="button" onClick={() => copy(row.memberId, ready.url)} className={`${action} border border-border-200 bg-white text-ink-900 hover:bg-paper-100`}>
                      <Copy className="size-4 shrink-0" aria-hidden="true" /> Copy<span className="sr-only"> {first}&apos;s link</span>
                    </button>
                  </div>
                  {copyFailed[row.memberId] ? (
                    <p role="alert" className="mt-1.5 text-note text-attn-ink">
                      Copying did not work here. Tap the link above, then copy it.
                    </p>
                  ) : null}
                </>
              ) : link && "old" in link ? (
                <div className="mt-2">
                  <p className="text-hint text-ink-900">{link.old}</p>
                  <button
                    type="button"
                    disabled={making === row.memberId}
                    onClick={() => makeLink(row.memberId)}
                    className={`${action} mt-2 border border-border-200 bg-white text-primary-700 hover:bg-sky-100 disabled:opacity-50`}
                  >
                    <Link2 className="size-4" aria-hidden="true" /> {making === row.memberId ? "Making it" : "Make a new link"}
                  </button>
                </div>
              ) : link && "error" in link ? (
                <p role="alert" className="mt-1 text-hint text-attn-ink">
                  {link.error}
                </p>
              ) : (
                <p className="mt-2 inline-flex items-center gap-2 text-hint text-ink-500">
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Getting {first}&apos;s link
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
