"use client";

import { Loader2, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { markToldAction, memberLinkAction, pendingUpdatesAction } from "@/app/actions/members";
import { memberUrl } from "@/components/circles/member-link";
import { ShareLink, type ShareableLink } from "@/components/circles/ShareLink";
import { changedWords, type UpdateArea } from "@/lib/link-life";

type Pending = { memberId: string; name: string; areas: UpdateArea[] };

const firstName = (name: string) => name.trim().split(/\s+/)[0] || name.trim();

function names(people: readonly Pending[]): string {
  const firsts = people.map((person) => firstName(person.name));
  if (firsts.length <= 2) return firsts.join(" and ");
  return `${firsts.slice(0, -1).join(", ")} and ${firsts.at(-1)}`;
}

/**
 * Shown to the caregiver after they change medicines, the calendar, reminders or the care summary
 * (by hand or from a visit summary) while someone who can see that has not heard about it. Each
 * name sends that person their same link with a message saying what changed. It goes away once
 * everyone is told, or opens their link, or the caregiver skips it.
 *
 * `pending` comes from the server (the circle's pages). Without it, the list is fetched here (the
 * end of a visit, which is not inside the circle's pages).
 */
export function ShareUpdates({ circleId, personName, pending: initial }: { circleId: string; personName: string; pending?: Pending[] }) {
  const router = useRouter();
  const [pending, setPending] = useState<Pending[] | null>(initial ?? null);
  const [share, setShare] = useState<{ link: ShareableLink; memberId: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();

  useEffect(() => {
    if (initial) setPending(initial);
  }, [initial]);

  useEffect(() => {
    if (initial) return;
    let cancel = false;
    pendingUpdatesAction(circleId)
      .then((list) => {
        if (!cancel) setPending(list);
      })
      .catch(() => undefined);
    return () => {
      cancel = true;
    };
  }, [circleId, initial]);

  if (!pending?.length && !share) return null;
  const list = pending ?? [];
  const areas = [...new Set(list.flatMap((person) => person.areas))];

  function told(memberIds: string[]) {
    setPending((all) => (all ?? []).filter((person) => !memberIds.includes(person.memberId)));
    start(async () => {
      await markToldAction({ circleId, memberIds }).catch(() => undefined);
      if (initial) router.refresh();
    });
  }

  async function open(person: Pending) {
    setError(null);
    setBusy(person.memberId);
    try {
      const result = await memberLinkAction({ circleId, memberId: person.memberId });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setShare({
        memberId: person.memberId,
        link: { url: memberUrl(result.token), name: result.name, email: result.email, hasPin: result.hasPin, personName, changed: changedWords(person.areas) },
      });
    } catch {
      setError("The link could not be opened. Try again.");
    } finally {
      setBusy(null);
    }
  }

  if (share) {
    return (
      <div className="mb-5 max-w-xl">
        <ShareLink
          link={share.link}
          fresh={false}
          onSent={() => told([share.memberId])}
          onDone={() => {
            told([share.memberId]);
            setShare(null);
          }}
        />
      </div>
    );
  }

  return (
    <section aria-labelledby="share-updates-title" className="mb-5 rounded-lg border border-primary-700/25 bg-sky-100/60 p-4">
      <h2 id="share-updates-title" className="text-[15px] font-semibold text-primary-900">
        Let people know what changed
      </h2>
      <p className="mt-0.5 text-[14px] text-ink-900">
        You changed {changedWords(areas)}. {names(list)} {list.length === 1 ? "has" : "have"} not seen it yet. Send them their link with a note; it is the same link they already have.
      </p>
      {error ? (
        <p role="alert" className="mt-2 rounded-md bg-attn-bg px-3 py-2 text-[13px] text-attn-ink">
          {error}
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {list.map((person) => (
          <button
            key={person.memberId}
            type="button"
            disabled={busy !== null}
            onClick={() => open(person)}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary-700 px-4 text-[14px] font-semibold text-white hover:bg-primary-900 disabled:opacity-50"
          >
            {busy === person.memberId ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Send className="size-4" aria-hidden="true" />}
            Tell {firstName(person.name)}
          </button>
        ))}
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => told(list.map((person) => person.memberId))}
          className="inline-flex min-h-11 items-center rounded-lg px-3 text-[14px] font-medium text-ink-500 hover:bg-white hover:text-ink-900 disabled:opacity-50"
        >
          Skip this time
        </button>
      </div>
    </section>
  );
}
