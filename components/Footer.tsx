import Link from "next/link";
import { COPY } from "@/lib/copy";
import { SOURCE_URL } from "./AppBar";
import { Logo } from "./Logo";

export function Footer() {
  return (
    <footer className="no-print border-t border-border-200 bg-surface-50">
      <div className="mx-auto max-w-[1120px] px-4 py-10 sm:px-6">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Logo size={34} />
            <p className="mt-2 text-ink-500">A shared care page for the person you look after.</p>
          </div>
          <nav className="flex flex-wrap gap-x-6 gap-y-2 font-medium text-ink-900/80" aria-label="Footer">
            <Link href="/#how" className="underline-offset-4 hover:text-primary-900 hover:underline">
              How it works
            </Link>
            <Link href="/privacy" className="underline-offset-4 hover:text-primary-900 hover:underline">
              Privacy
            </Link>
            <Link href="/privacy/health-data" className="underline-offset-4 hover:text-primary-900 hover:underline">
              Health data notice
            </Link>
            <a href={SOURCE_URL} className="underline-offset-4 hover:text-primary-900 hover:underline" target="_blank" rel="noreferrer">
              Source code
            </a>
          </nav>
        </div>
        <p className="mt-6 border-t border-border-200 pt-5 text-sm text-ink-500">{COPY.notMedicalAdvice} Free and open source (AGPL-3.0).</p>
      </div>
    </footer>
  );
}
