"use client";

import { Check, Loader2, Send } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { shareLinkAction } from "@/app/actions/members";
import { urlForMemberToken } from "@/components/circles/member-link";
import { ShareLink, type ShareableLink } from "@/components/circles/ShareLink";
import { saveLink } from "@/lib/local-links";

type Helper = { id: string; name: string; roleLabel: string; email: string | null };

const firstName = (name: string) => name.trim().split(/\s+/)[0] || name.trim();

/**
 * Shown once a visit has updated the circle: one button per person. Tapping it makes that person
 * a new link and a new PIN (the old ones stop working), then offers Email, Text or Copy with the
 * message already written. Nobody's link changes unless the caregiver taps their name.
 */
export function TellPeople({ circleId, personName, helpers, keyVersion }: { circleId: string; personName: string; helpers: Helper[]; keyVersion: number | null }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [share, setShare] = useState<ShareableLink | null>(null);
  const [links, setLinks] = useState<Record<string, ShareableLink>>({});
  const [error, setError] = useState<string | null>(null);

  if (!helpers.length) {
    return (
      <p className="mt-4 rounded-md bg-paper-100 px-3 py-2 text-[14px] text-ink-500">
        Nobody else is in this circle yet.{" "}
        <Link href={`/circles/${circleId}/members`} className="font-semibold text-primary-700 underline underline-offset-2">
          Add a person
        </Link>{" "}
        to share it.
      </p>
    );
  }

  async function send(helper: Helper) {
    // A link made a moment ago is shown again, not replaced, so a second tap never breaks the one just sent.
    const made = links[helper.id];
    if (made) {
      setShare(made);
      return;
    }
    setError(null);
    setBusy(helper.id);
    try {
      const result = await shareLinkAction({ circleId, memberId: helper.id });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const built = await urlForMemberToken(circleId, result.token, keyVersion);
      if (!built.ok) {
        setError(built.error);
        return;
      }
      saveLink(circleId, result.memberId, built.url);
      const link: ShareableLink = { url: built.url, name: result.name, email: result.email, pin: result.pin, personName, afterVisit: true };
      setLinks((all) => ({ ...all, [helper.id]: link }));
      setShare(link);
    } catch {
      setError("The link could not be made. Try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section aria-labelledby="tell-title" className="mt-5 border-t border-border-200 pt-5">
      <h2 id="tell-title" className="font-display text-[20px] text-primary-900">
        Tell the people who help
      </h2>
      <p className="mt-1 text-[14px] text-ink-500">Tap a name to send them a new link and a new PIN. Their old link stops working.</p>
      {error ? (
        <p role="alert" className="mt-3 rounded-md bg-attn-bg px-3 py-2 text-[13px] text-attn-ink">
          {error}
        </p>
      ) : null}
      {share ? (
        <div className="mt-3">
          <ShareLink key={share.url} link={share} fresh={false} onDone={() => setShare(null)} />
        </div>
      ) : (
        <ul className="mt-3 grid gap-2">
          {helpers.map((helper) => {
            const made = Boolean(links[helper.id]);
            return (
              <li key={helper.id}>
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => send(helper)}
                  className="flex min-h-14 w-full items-center gap-3 rounded-lg border border-border-200 bg-white px-4 text-left hover:bg-sky-100 disabled:opacity-50"
                >
                  {busy === helper.id ? (
                    <Loader2 className="size-5 shrink-0 animate-spin text-primary-700" aria-hidden="true" />
                  ) : made ? (
                    <Check className="size-5 shrink-0 text-ok" aria-hidden="true" />
                  ) : (
                    <Send className="size-5 shrink-0 text-primary-700" aria-hidden="true" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-semibold text-ink-900">
                      {made ? `Send to ${firstName(helper.name)} again` : `Send to ${firstName(helper.name)}`}
                    </span>
                    <span className="block truncate text-[13px] text-ink-500">
                      {helper.name} · {helper.roleLabel}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
