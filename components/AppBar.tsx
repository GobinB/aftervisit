import Link from "next/link";
import { Logo } from "./Logo";
import { StartSample } from "./StartSample";

export const SOURCE_URL = "https://github.com/GobinB/aftervisit";

/** `minimal` hides the marketing links inside the create flow. */
export function AppBar({ minimal = false }: { minimal?: boolean }) {
  return (
    <header className="no-print sticky top-0 z-30 h-16 border-b border-border-200 bg-white">
      <div className="mx-auto flex h-full max-w-[1120px] items-center justify-between gap-3 px-4 sm:px-6">
        <Link href="/" className="rounded-lg" aria-label="AfterVisit home">
          <Logo />
        </Link>
        {minimal ? null : (
          <nav aria-label="Main" className="flex items-center gap-1 sm:gap-2">
            <Link href="/#how" className="hidden rounded-lg px-3 py-2 font-medium text-ink-900/80 hover:text-primary-900 sm:inline-block">
              How it works
            </Link>
            <Link href="/privacy" className="hidden rounded-lg px-3 py-2 font-medium text-ink-900/80 hover:text-primary-900 md:inline-block">
              Privacy
            </Link>
            <StartSample label="Try a sample visit" variant="pill" />
          </nav>
        )}
      </div>
    </header>
  );
}
