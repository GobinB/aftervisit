import Link from "next/link";
import { Logo } from "./Logo";
import { SiteMenu } from "./SiteMenu";
import { StartSample } from "./StartSample";

export const SOURCE_URL = "https://github.com/GobinB/aftervisit";

/** `minimal` hides the marketing links inside the create flow. Sign in goes to /circles, which asks a signed-out visitor to sign in. */
export function AppBar({ minimal = false }: { minimal?: boolean }) {
  return (
    <header className="no-print sticky top-0 z-30 h-16 border-b border-border-200 bg-white">
      <div className="mx-auto flex h-full max-w-[1120px] items-center justify-between gap-3 px-4 sm:px-6">
        <Link href="/" className="rounded-lg" aria-label="All Hands Care home">
          <Logo />
        </Link>
        {minimal ? null : (
          <nav aria-label="Main" className="flex items-center gap-1 sm:gap-2">
            <Link href="/#how" className="hidden rounded-lg px-3 py-2 font-medium text-ink-900/80 hover:text-primary-900 lg:inline-block">
              How it works
            </Link>
            <Link href="/privacy" className="hidden rounded-lg px-3 py-2 font-medium text-ink-900/80 hover:text-primary-900 lg:inline-block">
              Privacy
            </Link>
            <StartSample label="Try a sample visit" variant="secondary" className="max-lg:hidden" />
            <SiteMenu />
            <Link
              href="/circles"
              className="inline-flex min-h-10 items-center rounded-full px-3 font-semibold whitespace-nowrap sm:px-4 text-ink-900 ring-1 ring-ink-900/20 hover:ring-ink-900/40"
            >
              Sign in
            </Link>
          </nav>
        )}
      </div>
    </header>
  );
}
