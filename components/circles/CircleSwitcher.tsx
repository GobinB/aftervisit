"use client";

import { Check, ChevronDown, Home } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export type SwitcherCircle = { id: string; personName: string; kind: "run" | "help"; roleLabel?: string };

/** The circle this address is in, if any. */
function currentCircle(pathname: string): string | null {
  return /^\/circles\/([0-9a-f-]{36})(?:\/|$)/i.exec(pathname)?.[1] ?? null;
}

/**
 * Moves between the circles someone signed in is in: the ones they run and the ones they help with.
 * Shown only with two or more, inside one of them (on /circles the list is the page). `tone` matches
 * where it sits: the navy sidebar, or the white row under the phone top bar.
 */
export function CircleSwitcher({ circles, tone }: { circles: SwitcherCircle[]; tone: "dark" | "light" }) {
  const pathname = usePathname();
  const currentId = currentCircle(pathname);
  const current = circles.find((circle) => circle.id === currentId);
  if (circles.length < 2 || !current) return null;
  const dark = tone === "dark";
  return (
    // Keyed on the address, so the list closes after a choice.
    <details key={pathname} className={`group relative ${dark ? "mx-2 mt-3" : "mx-auto max-w-xl"}`}>
      <summary
        className={`flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-lg px-3 text-[14px] font-semibold [&::-webkit-details-marker]:hidden ${
          dark ? "bg-white/[0.08] text-white hover:bg-white/[0.14]" : "border border-border-200 bg-white text-ink-900 hover:bg-sky-100/60"
        }`}
        aria-label={`Switch circle. Now: ${current.personName}`}
      >
        <span className="min-w-0 flex-1 truncate">
          {dark ? null : <span className="font-normal text-ink-500">Circle: </span>}
          {current.personName}
        </span>
        <ChevronDown className="size-4 shrink-0 transition-transform group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div
        className={`absolute left-0 z-50 mt-1 overflow-hidden rounded-lg border py-1 shadow-lg ${dark ? "w-64 border-white/10 bg-sidebar" : "right-0 border-border-200 bg-white"}`}
      >
        <p className={`px-3 pt-1.5 pb-1 text-[11px] font-bold tracking-[0.1em] uppercase ${dark ? "text-sidebar-text" : "text-ink-500"}`}>Your circles</p>
        <ul>
          {circles.map((circle) => {
            const on = circle.id === currentId;
            return (
              <li key={circle.id}>
                <Link
                  href={`/circles/${circle.id}`}
                  aria-current={on ? "page" : undefined}
                  className={`flex min-h-12 items-center gap-2 px-3 py-1.5 ${dark ? "text-white hover:bg-white/[0.08]" : "text-ink-900 hover:bg-sky-100/60"}`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold">{circle.personName}</span>
                    <span className={`block text-[12px] ${dark ? "text-white/70" : "text-ink-500"}`}>{circle.kind === "run" ? "You run this circle" : `You help · ${circle.roleLabel ?? "Helper"}`}</span>
                  </span>
                  {on ? <Check className="size-4 shrink-0" aria-hidden="true" /> : null}
                </Link>
              </li>
            );
          })}
        </ul>
        <Link
          href="/circles"
          className={`flex min-h-11 items-center gap-2 border-t px-3 text-[14px] font-semibold ${dark ? "border-white/10 text-white/85 hover:bg-white/[0.08]" : "border-border-200 text-primary-700 hover:bg-sky-100/60"}`}
        >
          <Home className="size-4" aria-hidden="true" />
          All your circles
        </Link>
      </div>
    </details>
  );
}
