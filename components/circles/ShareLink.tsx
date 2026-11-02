"use client";

import { useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/Button";

const field =
  "mt-1.5 w-full min-h-12 rounded-xl border border-border-200 bg-white px-3 text-base text-ink-900 outline-none focus:border-action-500";

/** Copy, share, or hand the full link to the mail app. The key is in the hash. */
export function ShareLink({ link, onDone }: { link: { url: string; name: string; email: string | null }; onDone: () => void }) {
  const inputId = useId();
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);
  useEffect(() => {
    setCanShare(typeof navigator.share === "function");
  }, []);

  const mail = `mailto:${link.email ?? ""}?subject=${encodeURIComponent("A link for you")}&body=${encodeURIComponent(`Here is your AfterVisit link:\n${link.url}\n\nIf there is a PIN, it will come separately. If the message drops the part after #, use the copied link instead.`)}`;

  return (
    <div role="status" className="space-y-3 rounded-2xl border border-border-200 bg-sky-100 p-4">
      <p className="font-semibold text-primary-900">Link for {link.name}</p>
      <p className="text-sm text-ink-500">Shown once. Copy the whole link. The part after # opens files and stays in the browser. AfterVisit does not receive it and does not send the link.</p>
      <label className="sr-only" htmlFor={inputId}>
        Personal link for {link.name}
      </label>
      <input id={inputId} readOnly value={link.url} onFocus={(event) => event.target.select()} className={field} />
      <div className="grid gap-2">
        <Button
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(link.url);
              setCopied(true);
            } catch {
              setCopied(false);
            }
          }}
        >
          Copy link
        </Button>
        {canShare ? (
          <Button
            variant="secondary"
            onClick={async () => {
              try {
                await navigator.share({ title: "AfterVisit", text: `A link for ${link.name}:\n${link.url}`, url: link.url });
              } catch {
                // The person closed the share sheet.
              }
            }}
          >
            Share
          </Button>
        ) : null}
        <a href={mail} className="inline-flex min-h-12 items-center justify-center rounded-xl border-2 border-primary-700 px-5 font-semibold text-primary-700">
          Email link
        </a>
        <Button variant="ghost" onClick={onDone}>
          Done
        </Button>
      </div>
      <p aria-live="polite" className="text-sm text-primary-700">
        {copied ? "Copied." : ""}
      </p>
    </div>
  );
}
