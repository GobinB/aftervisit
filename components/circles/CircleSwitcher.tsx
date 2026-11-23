"use client";

import { Check, ChevronDown, Home } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export type SwitcherCircle = { id: string; personName: string; kind: "run" | "help"; roleLabel?: string };

/** The circle this address is in, if any. */
function currentCircle(pathname: string): string | null {
  return /^\/circles\/([0-9a-f-]{36})(?:\/|$)/i.exec(pathname)?.[1] ?? null;
}

const NAME = "font-display text-page tracking-[-0.01em] break-words text-primary-900";

/**
 * The person's name, large, at the top of every circle screen. For someone signed in with two or more
 * circles (the ones they run and the ones they help with) the name is also the way to move between
 * them: tapping it opens the list. It is the only switcher, on phones and computers alike.
 */
export function CircleName({ personName, circles }: { personName: string; circles: SwitcherCircle[] }) {
  const pathname = usePathname();
  const currentId = currentCircle(pathname);
  const current = circles.find((circle) => circle.id === currentId);
  if (circles.length < 2 || !current) return <p className={NAME}>{personName}</p>;
  return (
    // Keyed on the address, so the list closes after a choice.
    <details key={pathname} className="group relative max-w-full">
      <summary
        className="-mx-2 inline-flex max-w-full cursor-pointer list-none items-center gap-3 rounded-lg px-2 py-1 hover:bg-sky-100/60 [&::-webkit-details-marker]:hidden"
        aria-label={`Switch circle. Now: ${current.personName}`}
      >
        <span className={`min-w-0 ${NAME}`}>{current.personName}</span>
        <span className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-lg border border-border-200 bg-white px-3 text-hint font-semibold text-primary-700 shadow-sm">
          Switch
          <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden="true" />
        </span>
      </summary>
      <div className="absolute left-0 z-50 mt-1 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg border border-border-200 bg-white py-1 shadow-lg">
        <p className="px-3 pt-1.5 pb-1 text-tag font-bold tracking-[0.1em] text-ink-500 uppercase">Your circles</p>
        <ul>
          {circles.map((circle) => {
            const on = circle.id === currentId;
            return (
              <li key={circle.id}>
                <Link href={`/circles/${circle.id}`} aria-current={on ? "page" : undefined} className="flex min-h-12 items-center gap-2 px-3 py-1.5 text-ink-900 hover:bg-sky-100/60">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-name font-semibold">{circle.personName}</span>
                    <span className="block text-hint text-ink-500">{circle.kind === "run" ? "You run this circle" : `You help · ${circle.roleLabel ?? "Helper"}`}</span>
                  </span>
                  {on ? <Check className="size-4 shrink-0" aria-hidden="true" /> : null}
                </Link>
              </li>
            );
          })}
        </ul>
        <Link href="/circles" className="flex min-h-11 items-center gap-2 border-t border-border-200 px-3 text-label font-semibold text-primary-700 hover:bg-sky-100/60">
          <Home className="size-4" aria-hidden="true" />
          All your circles
        </Link>
      </div>
    </details>
  );
}
