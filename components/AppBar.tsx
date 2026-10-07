import Link from "next/link";
import { Logo } from "./Logo";

export const SOURCE_URL = "https://github.com/GobinB/aftervisit";

export function AppBar() {
  return (
    <header className="no-print sticky top-0 z-30 h-16 border-b border-border-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-full max-w-[1100px] items-center justify-between px-4">
        <Link href="/" className="rounded-lg" aria-label="AfterVisit home">
          <Logo />
        </Link>
        <nav aria-label="Main" className="flex items-center gap-1 text-[0.95rem] font-medium">
          <Link href="/#how" className="hidden rounded-lg px-3 py-2 text-ink-500 hover:bg-sky-100 hover:text-primary-900 sm:inline-block">
            How it works
          </Link>
          <Link href="/privacy" className="rounded-lg px-3 py-2 text-ink-500 hover:bg-sky-100 hover:text-primary-900">
            Privacy
          </Link>
        </nav>
      </div>
    </header>
  );
}
