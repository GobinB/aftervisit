import Link from "next/link";
import { BottomBar, CircleNavProvider, HeaderTitle, SidebarCircleNav, type NavTab } from "@/components/circles/CircleNav";
import { Logo } from "@/components/Logo";
import { SignOut } from "@/components/circles/SignOut";
import { COPY } from "@/lib/copy";

export type ShellCircle = { personName: string; tabs: NavTab[] };

/**
 * Frame for signed-in and helper screens. On wide screens a dark sidebar holds the circle's areas
 * and a slim header names the page; on phones the header shows the logo and the areas sit in a bottom bar.
 * Inside a circle it is drawn once by app/circles/[id]/layout.tsx and stays on screen between areas.
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
  const homeHref = signedIn ? "/circles" : "/";
  const tabs = circle?.tabs ?? [];
  const personName = circle?.personName ?? null;
  return (
    <CircleNavProvider>
      <div className="flex min-h-dvh bg-paper-100">
        <aside className="no-print sticky top-0 hidden h-dvh w-[220px] shrink-0 flex-col bg-sidebar text-sidebar-text lg:flex">
          <Link
            href={homeHref}
            className="block border-b border-white/[0.07] px-[18px] pt-5 pb-4"
            aria-label={signedIn ? "All Hands Care, your circles" : "All Hands Care home"}
          >
            <Logo size={32} variant="onDark" />
          </Link>
          <SidebarCircleNav signedIn={signedIn} personName={personName} tabs={tabs} />
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="no-print sticky top-0 z-30 flex min-h-16 items-center justify-between gap-3 border-b border-border-200 bg-white px-4 sm:px-6">
            <Link href={homeHref} className="-ml-1 rounded-lg p-1 lg:hidden" aria-label={signedIn ? "All Hands Care, your circles" : "All Hands Care home"}>
              <Logo size={34} />
            </Link>
            <HeaderTitle fallback={signedIn ? "Your circles" : "Care circle"} personName={personName} tabs={tabs} />
            <nav aria-label="Account" className="flex items-center gap-1 text-[13px]">
              <Link href="/privacy" className="rounded-lg px-2 py-2 font-medium text-ink-500 hover:text-ink-900">
                Privacy
              </Link>
              {signedIn ? <SignOut /> : null}
            </nav>
          </header>
          <main id="main" data-shell="sidebar" className={`group/shell mx-auto w-full min-w-0 ${width} flex-1 px-4 pt-5 sm:px-6 ${circle ? "pb-28 lg:pb-12" : "pb-12"}`}>
            {children}
          </main>
          <p className={`no-print mx-auto w-full ${width} border-t border-border-200 px-4 py-5 text-xs text-ink-500 sm:px-6 ${circle ? "mb-20 lg:mb-0" : ""}`}>
            {COPY.notMedicalAdvice}
          </p>
        </div>
        {circle ? <BottomBar tabs={tabs} /> : null}
      </div>
    </CircleNavProvider>
  );
}
