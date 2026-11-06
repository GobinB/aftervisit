"use client";

import { CalendarCheck, CalendarDays, ClipboardList, Home, ListChecks, MoreHorizontal, Pill, Settings, Users, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useState } from "react";
import type { CircleTab } from "@/components/circles/CircleFrame";

export type NavTab = { key: CircleTab; label: string; href: string };

/** Short names for the phone bar, where four sit side by side. */
const SHORT_LABELS: Record<CircleTab, string> = {
  overview: "Today",
  calendar: "Calendar",
  todos: "Reminders",
  medications: "Meds",
  summary: "Summary",
  people: "People",
  settings: "Settings",
};

const TAB_ICONS: Record<CircleTab, LucideIcon> = {
  overview: CalendarCheck,
  calendar: CalendarDays,
  todos: ListChecks,
  medications: Pill,
  summary: ClipboardList,
  people: Users,
  settings: Settings,
};

/**
 * Which area the address is in. Today is the circle's own address; every other area also owns
 * the pages under it (an edit page under Medications is still Medications).
 */
export function activeTab(pathname: string, tabs: NavTab[]): NavTab | undefined {
  return [...tabs]
    .sort((a, b) => b.href.length - a.href.length)
    .find((tab) => (tab.key === "overview" ? pathname === tab.href : pathname === tab.href || pathname.startsWith(`${tab.href}/`)));
}

/**
 * The address the person just clicked, before its page arrives, so the highlight moves at once.
 * Shared by the sidebar and the phone bar, and cleared when the address changes.
 */
const Pending = createContext<{ href: string | null; set: (href: string | null) => void }>({ href: null, set: () => {} });

export function CircleNavProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [href, set] = useState<string | null>(null);
  useEffect(() => set(null), [pathname]);
  return <Pending.Provider value={{ href, set }}>{children}</Pending.Provider>;
}

function useActive(tabs: NavTab[]): CircleTab | null {
  const pathname = usePathname();
  const { href } = useContext(Pending);
  return activeTab(href ?? pathname, tabs)?.key ?? null;
}

function useMarkPending() {
  return useContext(Pending).set;
}

/** The circle's areas in the navy sidebar. The highlight follows the address, so it moves the moment a link is clicked. */
export function SidebarCircleNav({ signedIn, personName, tabs }: { signedIn: boolean; personName: string | null; tabs: NavTab[] }) {
  const pathname = usePathname();
  const active = useActive(tabs);
  const mark = useMarkPending();
  return (
    <nav aria-label="Circle areas" className="flex-1 py-2">
      {signedIn ? <SidebarLink href="/circles" icon={Home} label="Your circles" active={pathname === "/circles"} onPick={mark} /> : null}
      {personName ? (
        <>
          <p className="mx-[18px] mt-4 mb-1 truncate text-[11px] font-bold tracking-[0.1em] text-sidebar-text uppercase">{personName}</p>
          {tabs.map((tab) => (
            <SidebarLink key={tab.key} href={tab.href} icon={TAB_ICONS[tab.key]} label={tab.label} active={tab.key === active} onPick={mark} />
          ))}
        </>
      ) : null}
    </nav>
  );
}

/** The page name in the slim header on wide screens. */
export function HeaderTitle({ fallback, personName, tabs }: { fallback: string; personName: string | null; tabs: NavTab[] }) {
  const pathname = usePathname();
  const { href } = useContext(Pending);
  const tab = activeTab(href ?? pathname, tabs);
  return (
    <div className="hidden min-w-0 lg:block">
      <p className="truncate text-base leading-5 font-semibold text-ink-900">{tab?.label ?? fallback}</p>
      {personName ? <p className="mt-0.5 truncate text-[11px] text-ink-500">{personName}</p> : null}
    </div>
  );
}

/** Phones: the circle's areas along the bottom, within thumb reach. Wide screens use the sidebar. */
export function BottomBar({ tabs }: { tabs: NavTab[] }) {
  const pathname = usePathname();
  const active = useActive(tabs);
  const mark = useMarkPending();
  // Five fit side by side. With more, the last spot is "More", which opens the rest.
  const fits = tabs.length <= 5;
  const shown = fits ? tabs : tabs.slice(0, 4);
  const rest = fits ? [] : tabs.slice(4);
  const restActive = rest.some((tab) => tab.key === active);
  // Dark bar, white bold labels; the current area gets a coral bar on top and a lighter tile.
  const item = (on: boolean) =>
    `relative flex min-h-16 w-full flex-col items-center justify-center gap-1 text-[12px] font-bold tracking-[0.01em] ${
      on ? "bg-white/[0.12] text-white before:absolute before:inset-x-3 before:top-0 before:h-[3px] before:rounded-b before:bg-heart-500" : "text-white/80 hover:bg-white/[0.06] hover:text-white"
    }`;
  return (
    <nav aria-label="Circle areas" className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-sidebar pb-[env(safe-area-inset-bottom)] shadow-[0_-2px_10px_rgb(0_0_0/0.12)] lg:hidden">
      <ul className="mx-auto flex max-w-xl">
        {shown.map((tab) => {
          const Icon = TAB_ICONS[tab.key];
          const on = tab.key === active;
          return (
            <li key={tab.key} className="flex-1">
              <Link href={tab.href} aria-current={on ? "page" : undefined} className={item(on)} onClick={() => mark(tab.href)}>
                <Icon className="size-[22px]" strokeWidth={on ? 2.5 : 2} aria-hidden="true" />
                {SHORT_LABELS[tab.key]}
              </Link>
            </li>
          );
        })}
        {rest.length ? (
          <li className="flex-1">
            {/* Keyed on the address, so the menu closes after a choice. */}
            <details key={pathname} className="group relative">
              <summary className={`${item(restActive)} cursor-pointer list-none [&::-webkit-details-marker]:hidden`}>
                <MoreHorizontal className="size-[22px]" strokeWidth={restActive ? 2.5 : 2} aria-hidden="true" />
                More
              </summary>
              <ul className="absolute right-2 bottom-full mb-2 w-52 overflow-hidden rounded-lg border border-white/10 bg-sidebar py-1 shadow-lg">
                {rest.map((tab) => {
                  const Icon = TAB_ICONS[tab.key];
                  const on = tab.key === active;
                  return (
                    <li key={tab.key}>
                      <Link
                        href={tab.href}
                        onClick={() => mark(tab.href)}
                        aria-current={on ? "page" : undefined}
                        className={`flex min-h-12 items-center gap-2.5 border-l-[3px] px-3 text-[15px] font-bold ${
                          on ? "border-heart-500 bg-white/[0.12] text-white" : "border-transparent text-white/85 hover:bg-white/[0.06] hover:text-white"
                        }`}
                      >
                        <Icon className="size-4" aria-hidden="true" />
                        {tab.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </details>
          </li>
        ) : null}
      </ul>
    </nav>
  );
}

function SidebarLink({
  href,
  icon: Icon,
  label,
  active,
  onPick,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  active: boolean;
  onPick: (href: string) => void;
}) {
  return (
    <Link
      href={href}
      onClick={() => onPick(href)}
      aria-current={active ? "page" : undefined}
      className={`mx-2 my-0.5 flex items-center gap-3 rounded-md border-l-[3px] px-3 py-2.5 text-[14px] font-semibold transition-colors ${
        active ? "border-l-heart-500 bg-white/[0.12] text-white" : "border-transparent text-white/80 hover:bg-white/[0.06] hover:text-white"
      }`}
    >
      <Icon className="size-[18px] shrink-0" strokeWidth={active ? 2.5 : 2} aria-hidden="true" />
      <span className="truncate">{label}</span>
    </Link>
  );
}
