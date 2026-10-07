import Link from "next/link";
import { COPY } from "@/lib/copy";
import { SOURCE_URL } from "./AppBar";
import { LogoMark, Wordmark } from "./Logo";

export function Footer() {
  return (
    <footer className="no-print bg-primary-900 text-white/80">
      <div className="mx-auto max-w-[1100px] px-4 py-10">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-md">
            <span className="flex items-center gap-2.5">
              <LogoMark size={32} variant="onDark" />
              <Wordmark tone="onDark" className="text-lg" />
            </span>
            <p className="mt-3 text-sm leading-relaxed">{COPY.notMedicalAdvice}</p>
          </div>
          <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm font-medium" aria-label="Footer">
            <Link href="/#how" className="hover:text-white hover:underline underline-offset-4">
              How it works
            </Link>
            <Link href="/privacy" className="hover:text-white hover:underline underline-offset-4">
              Privacy
            </Link>
            <a href={SOURCE_URL} className="hover:text-white hover:underline underline-offset-4" target="_blank" rel="noreferrer">
              Source code
            </a>
          </nav>
        </div>
        <p className="mt-8 border-t border-white/15 pt-6 text-xs text-white/60">
          Open source under the AGPL-3.0 license. Questions about care go to the clinic.
        </p>
      </div>
    </footer>
  );
}
