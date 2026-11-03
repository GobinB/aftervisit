"use client";

import { useEffect, useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { rotateCircleKey } from "@/app/actions/circles";
import { ShareLink } from "@/components/circles/ShareLink";
import { Button } from "@/components/ui/Button";
import { buildHelperLink, exportKeyBytes, generateCircleKey, loadCircleKey, saveCircleKey, unwrapCircleKey, wrapCircleKey } from "@/lib/crypto";
import { nextCircleKeyVersion, type CircleKeyStatus } from "@/lib/schema/circles";

const field =
  "mt-1.5 w-full min-h-12 rounded-xl border border-border-200 bg-white px-3 text-base text-ink-900 outline-none focus:border-action-500";

type ReadyLink = { url: string; name: string; email: string | null };

/** The owner replaces the circle key and prepares a new link for each helper. */
export function RotateKey({ circle }: { circle: CircleKeyStatus }) {
  const router = useRouter();
  const baseId = useId();
  const [open, setOpen] = useState(false);
  const [localReady, setLocalReady] = useState(false);
  const [phrase, setPhrase] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [links, setLinks] = useState<ReadyLink[] | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    let cancel = false;
    loadCircleKey(circle.circleId)
      .then((local) => {
        if (!cancel) setLocalReady(!!local && local.keyVersion === circle.circleKeyVersion && !!circle.wrapped && circle.wrappedKeyVersion === circle.circleKeyVersion);
      })
      .catch(() => {
        if (!cancel) setLocalReady(false);
      });
    return () => {
      cancel = true;
    };
  }, [circle.circleId, circle.circleKeyVersion, circle.wrapped, circle.wrappedKeyVersion]);

  if (!localReady || !circle.wrapped) return null;

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const wrapped = circle.wrapped;
    if (!wrapped) return;
    start(async () => {
      try {
        await unwrapCircleKey(wrapped, phrase);
        const nextKey = await generateCircleKey();
        const circleKeyWrapped = await wrapCircleKey(nextKey, phrase);
        const keyVersion = nextCircleKeyVersion(circle.circleKeyVersion);
        setPhrase("");
        const result = await rotateCircleKey({ circleId: circle.circleId, circleKeyWrapped, keyVersion });
        if (!result.ok) {
          setError(result.error);
          return;
        }
        let stored = true;
        try {
          await saveCircleKey(circle.circleId, nextKey, result.keyVersion);
        } catch {
          stored = false;
        }
        const raw = await exportKeyBytes(nextKey);
        setLinks(result.links.map((item) => ({ name: item.name, email: item.email, url: buildHelperLink(window.location.origin, item.token, raw) })));
        setError(stored ? null : "The key was changed, but this browser could not store it. Enter the recovery words again on this device before you leave.");
        router.refresh();
      } catch (caught) {
        const message = caught instanceof Error && /not a recovery phrase|did not open|not valid/.test(caught.message) ? "Those words did not open the key." : "The key could not be changed. Try again.";
        setError(message);
      }
    });
  }

  if (links) {
    return (
      <div className="space-y-4 rounded-2xl border border-border-200 bg-white p-4">
        <h2 className="font-display text-section text-primary-900">New links</h2>
        <p>The key is new. Previous links no longer open the circle. Share each link below. The part after # is the new key.</p>
        {links.length ? (
          links.map((link) => <ShareLink key={link.url} link={link} onDone={() => setLinks(links.filter((item) => item.url !== link.url))} />)
        ) : (
          <p>No one else has a link yet. Links you create from now on include the new key.</p>
        )}
      </div>
    );
  }

  if (!open) {
    return (
      <Button variant="secondary" className="w-full" onClick={() => setOpen(true)}>
        New key for files
      </Button>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-2xl border border-border-200 bg-white p-4">
      <h2 className="font-display text-section text-primary-900">New key for files</h2>
      <p>This creates a new key for files in this circle. Everyone who helps needs a new link. Old links stop opening the circle.</p>
      <p>Other caregivers still have the old key on their accounts. This screen cannot give them the new key yet. Files they open after this change will not work until that exists.</p>
      <div>
        <label htmlFor={`${baseId}-phrase`} className="font-medium text-ink-900">
          Recovery words
        </label>
        <textarea
          id={`${baseId}-phrase`}
          value={phrase}
          onChange={(event) => setPhrase(event.target.value)}
          rows={4}
          required
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={300}
          className={`${field} min-h-24 py-2`}
        />
        <p className="mt-1 text-sm text-ink-500">The same words wrap the new key. They are not sent to AfterVisit.</p>
      </div>
      {error ? (
        <p role="alert" className="rounded-xl bg-attn-bg px-3 py-2 text-attn-ink">
          {error}
        </p>
      ) : null}
      <Button type="submit" className="w-full" disabled={pending} aria-busy={pending}>
        {pending ? "Saving" : "Create the new key"}
      </Button>
      <Button variant="ghost" className="w-full" onClick={() => setOpen(false)} disabled={pending}>
        Cancel
      </Button>
    </form>
  );
}
