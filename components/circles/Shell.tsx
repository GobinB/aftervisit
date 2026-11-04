import { CalendarCheck, ClipboardList, Home, Settings, Users, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { CircleTab } from "@/components/circles/CircleFrame";
import { Logo, LogoMark } from "@/components/Logo";
import { SignOut } from "@/components/circles/SignOut";
import { COPY } from "@/lib/copy";

export type ShellCircle = {
  personName: string;
  tabs: { key: CircleTab; label: string; href: string }[];
  active: CircleTab;
};

/** Short names for the phone bar, where four sit side by side. */
const SHORT_LABELS: Record<CircleTab, string> = { overview: "Today", summary: "Summary", people: "People", settings: "Settings" };

const TAB_ICONS: Record<CircleTab, LucideIcon> = {
  overview: CalendarCheck,
  summary: ClipboardList,
  people: Users,
  settings: Settings,
};

/**
 * Frame for signed-in and helper screens. On wide screens a dark sidebar holds the circle's areas
 * and a slim header names the page; on phones the header shows the logo and the areas sit under the title.
 * `narrow` suits one-column forms. `signedIn` shows Sign out and the list of circles.
 */
export function CircleShell({
  children,
  signedIn = false,
  narrow = false,
  circle,
}: {
  children: React.ReactNode;
  signedIn?: boolean;
  narrow?: boolean;
  circle?: ShellCircle;
}) {
  const width = narrow ? "max-w-xl" : "max-w-6xl";
  const activeTab = circle?.tabs.find((tab) => tab.key === circle.active);
  const pageTitle = activeTab?.label ?? (signedIn ? "Your circles" : "Care circle");
  const homeHref = signedIn ? "/circles" : "/";
  return (
    <div className="flex min-h-dvh bg-paper-100">
      <aside className="no-print sticky top-0 hidden h-dvh w-[220px] shrink-0 flex-col bg-sidebar text-sidebar-text lg:flex">
        <Link
          href={homeHref}
          className="flex items-center gap-2.5 border-b border-white/[0.07] px-[18px] pt-5 pb-4"
          aria-label={signedIn ? "All Hands Care, your circles" : "All Hands Care home"}
        >
          <LogoMark size={28} />
          <span>
            <span className="font-display block text-[19px] leading-none text-white">All Hands Care</span>
            <span className="mt-1 block text-[10px] font-medium tracking-[0.1em] text-sidebar-muted uppercase">Care circle</span>
          </span>
        </Link>
        <nav aria-label="Circle areas" className="flex-1 py-2">
          {signedIn ? <SidebarLink href="/circles" icon={Home} label="Your circles" active={!circle} /> : null}
          {circle ? (
            <>
              <p className="mx-[18px] mt-4 mb-1 truncate text-[10px] font-semibold tracking-[0.1em] text-sidebar-muted uppercase">{circle.personName}</p>
              {circle.tabs.map((tab) => (
                <SidebarLink key={tab.key} href={tab.href} icon={TAB_ICONS[tab.key]} label={tab.label} active={tab.key === circle.active} />
              ))}
            </>
          ) : null}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print sticky top-0 z-30 flex min-h-14 items-center justify-between gap-3 border-b border-border-200 bg-white px-4 sm:px-6">
          <Link href={homeHref} className="rounded-lg lg:hidden" aria-label={signedIn ? "All Hands Care, your circles" : "All Hands Care home"}>
            <Logo size={30} />
          </Link>
          <div className="hidden min-w-0 lg:block">
            <p className="truncate text-base leading-5 font-semibold text-ink-900">{pageTitle}</p>
            {circle ? <p className="mt-0.5 truncate text-[11px] text-ink-500">{circle.personName}</p> : null}
          </div>
          <nav aria-label="Account" className="flex items-center gap-1 text-[13px]">
            <Link href="/privacy" className="rounded-lg px-2 py-2 font-medium text-ink-500 hover:text-ink-900">
              Privacy
            </Link>
            {signedIn ? <SignOut /> : null}
          </nav>
        </header>
        <main id="main" data-shell="sidebar" className={`group/shell mx-auto w-full ${width} flex-1 px-4 pt-5 sm:px-6 ${circle ? "pb-28 lg:pb-12" : "pb-12"}`}>
          {children}
        </main>
        <p className={`no-print mx-auto w-full ${width} border-t border-border-200 px-4 py-5 text-xs text-ink-500 sm:px-6 ${circle ? "mb-20 lg:mb-0" : ""}`}>
          {COPY.notMedicalAdvice}
        </p>
      </div>
      {circle ? <BottomBar circle={circle} /> : null}
    </div>
  );
}

/** Phones: the circle's areas along the bottom, within thumb reach. Wide screens use the sidebar. */
function BottomBar({ circle }: { circle: ShellCircle }) {
  return (
    <nav
      aria-label="Circle areas"
      className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-border-200 bg-white pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <ul className="mx-auto flex max-w-xl">
        {circle.tabs.map((tab) => {
          const Icon = TAB_ICONS[tab.key];
          const active = tab.key === circle.active;
          return (
            <li key={tab.key} className="flex-1">
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${active ? "text-primary-700" : "text-ink-500 hover:text-ink-900"}`}
              >
                <Icon className="size-5" strokeWidth={active ? 2.25 : 1.75} aria-hidden="true" />
                {SHORT_LABELS[tab.key]}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function SidebarLink({ href, icon: Icon, label, active }: { href: string; icon: LucideIcon; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-2.5 border-l-2 px-[16px] py-[9px] text-[13px] transition-colors ${
        active ? "border-l-sidebar-accent bg-white/[0.08] text-white" : "border-transparent text-sidebar-muted hover:bg-white/5 hover:text-sidebar-text"
      }`}
    >
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      <span className="truncate">{label}</span>
    </Link>
  );
}
