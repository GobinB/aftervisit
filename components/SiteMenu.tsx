"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { StartSample } from "@/components/StartSample";

const MENU_LINKS = [
  { href: "/#how", label: "How it works" },
  { href: "/about", label: "About" },
  { href: "/care-teams", label: "For care teams" },
  { href: "/privacy", label: "Privacy" },
  { href: "/contact", label: "Contact and feedback" },
];

/** Links that do not fit in the phone header. Desktop shows them inline. */
export function SiteMenu() {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    }
    function onPointer(event: MouseEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
    };
  }, [open]);

  return (
    <div ref={root} className="relative lg:hidden">
      <button
        ref={button}
        type="button"
        className="inline-flex min-h-10 items-center rounded-full px-4 font-semibold text-ink-900 ring-1 ring-ink-900/20 hover:ring-ink-900/40"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
      >
        Menu
      </button>
      {open ? (
        <div id={menuId} role="group" aria-label="Site" className="absolute right-0 z-40 mt-2 w-64 rounded-xl border border-border-200 bg-white p-2">
          {MENU_LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="flex min-h-12 items-center rounded-lg px-3 font-medium text-ink-900 hover:bg-surface-50"
              onClick={() => setOpen(false)}
            >
              {label}
            </Link>
          ))}
          <div className="px-1 pt-1" onClick={() => setOpen(false)}>
            <StartSample label="Try a sample visit" variant="secondary" className="w-full" />
          </div>
        </div>
      ) : null}
    </div>
  );
}
