import Link from "next/link";
import { Logo } from "./Logo";

export const SOURCE_URL = "https://github.com/GobinB/aftervisit";

export function AppBar() {
  return (
    <header className="no-print sticky top-0 z-30 h-16 border-b border-border-200 bg-white">
      <div className="mx-auto flex h-full max-w-[1100px] items-center justify-between px-4">
        <Link href="/" className="rounded-lg" aria-label="AfterVisit home">
          <Logo />
        </Link>
        <a href={SOURCE_URL} className="text-sm text-ink-500 underline-offset-4 hover:underline" target="_blank" rel="noreferrer">
          Open source
        </a>
      </div>
    </header>
  );
}
