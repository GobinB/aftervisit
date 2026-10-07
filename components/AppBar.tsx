import Link from "next/link";
import { LogoMark } from "./Logo";

export const SOURCE_URL = "https://github.com/GobinB/aftervisit";

export function AppBar() {
  return (
    <header className="no-print sticky top-0 z-30 h-14 border-b border-border-200 bg-white">
      <div className="mx-auto flex h-full max-w-[1100px] items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 rounded-md text-[1.05rem] font-semibold text-primary-900">
          <LogoMark />
          AfterVisit
        </Link>
        <a href={SOURCE_URL} className="text-sm text-ink-500 underline-offset-4 hover:underline" target="_blank" rel="noreferrer">
          Open source
        </a>
      </div>
    </header>
  );
}
