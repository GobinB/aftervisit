"use client";

import { Check, Copy, Mail, MessageSquare } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { mailtoHref, smsHref } from "@/lib/share-message";

export type ShareableLink = { url: string; name: string; email: string | null; pin?: string | null; personName?: string; afterVisit?: boolean };

const choice =
  "flex min-h-16 w-full items-center gap-3 rounded-xl border-2 px-4 text-left text-[17px] font-bold transition-colors focus-visible:outline-offset-2";

/**
 * One screen with three choices for sending a person their link: Email, Text, or Copy.
 * Email and Text open the phone's own apps with a ready-written message holding the link and the PIN.
 */
export function ShareLink({ link, onDone, fresh = true }: { link: ShareableLink; onDone: () => void; fresh?: boolean }) {
  const [copied, setCopied] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const first = link.name.trim().split(/\s+/)[0] || link.name;
  const details = { name: link.name, personName: link.personName, url: link.url, pin: link.pin, afterVisit: link.afterVisit };

  useEffect(() => {
    heading.current?.focus();
    heading.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link.url);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section aria-labelledby="share-title" className="rounded-2xl border-2 border-primary-700/30 bg-white p-4 shadow-sm sm:p-5">
      {fresh ? (
        <p className="mb-1 inline-flex items-center gap-1.5 text-[13px] font-semibold text-ok-ink">
          <Check className="size-4" aria-hidden="true" /> {first} is added
        </p>
      ) : null}
      <h2 id="share-title" ref={heading} tabIndex={-1} className="font-display text-[24px] leading-tight text-primary-900 outline-none">
        Send {first} their {link.afterVisit ? "new " : ""}link
      </h2>
      <p className="mt-1 text-[15px] text-ink-500">
        Pick one. A message is written for you{link.pin ? ", with the PIN in it" : ""}.
      </p>
      <div className="mt-4 grid gap-2.5">
        <a href={mailtoHref(link.email, details)} className={`${choice} border-primary-700 bg-primary-700 text-white hover:bg-primary-900`}>
          <Mail className="size-6 shrink-0" aria-hidden="true" />
          <span className="flex-1">
            Email
            {link.email ? <span className="block text-[13px] font-medium text-white/80">{link.email}</span> : null}
          </span>
        </a>
        <a href={smsHref(details)} className={`${choice} border-primary-700 bg-white text-primary-700 hover:bg-sky-100`}>
          <MessageSquare className="size-6 shrink-0" aria-hidden="true" />
          <span className="flex-1">Text message</span>
        </a>
        <button type="button" onClick={copy} className={`${choice} border-border-200 bg-white text-ink-900 hover:bg-paper-100`}>
          {copied ? <Check className="size-6 shrink-0 text-ok" aria-hidden="true" /> : <Copy className="size-6 shrink-0" aria-hidden="true" />}
          <span className="flex-1">{copied ? "Link copied" : "Copy link"}</span>
        </button>
      </div>
      {link.pin ? (
        <p className="mt-3 text-[14px] text-ink-500">
          {first}&apos;s PIN is <span className="font-bold tracking-[0.15em] text-ink-900 tabular-nums">{link.pin}</span>
        </p>
      ) : null}
      <p aria-live="polite" className="sr-only">
        {copied ? "Link copied." : ""}
      </p>
      <button
        type="button"
        onClick={onDone}
        className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-lg px-4 text-[15px] font-semibold text-ink-500 hover:bg-paper-100 hover:text-ink-900"
      >
        Done
      </button>
    </section>
  );
}
