"use client";

import { Info, X } from "lucide-react";
import { useId, useState } from "react";

/** A small (i) button beside a page title. It opens one or two plain sentences on how the page works. */
export function Help({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls={id}
        aria-label={open ? "Hide help" : "How this page works"}
        className="no-print inline-flex size-8 shrink-0 items-center justify-center rounded-full border border-border-200 bg-white text-primary-700 hover:bg-sky-100"
      >
        {open ? <X className="size-4" aria-hidden="true" /> : <Info className="size-4" aria-hidden="true" />}
      </button>
      <p
        id={id}
        hidden={!open}
        role="note"
        className="order-last mt-2 w-full basis-full rounded-lg border border-sky-100 bg-sky-100/60 px-3 py-2.5 text-[14px] leading-snug text-ink-900"
      >
        {text}
      </p>
    </>
  );
}
