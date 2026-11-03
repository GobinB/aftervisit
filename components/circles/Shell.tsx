import Link from "next/link";
import { Logo } from "@/components/Logo";
import { COPY } from "@/lib/copy";

/** Phone-width frame for circle screens. Tokens come from the theme in app/globals.css. */
export function CircleShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-surface-50">
      <header className="no-print sticky top-0 z-30 h-16 border-b border-border-200 bg-white">
        <div className="mx-auto flex h-full max-w-lg items-center justify-between px-4">
          <Link href="/circles" className="rounded-lg" aria-label="Your circles">
            <Logo />
          </Link>
          <Link href="/privacy" className="rounded-lg px-2 py-2 font-medium text-primary-700">
            Privacy
          </Link>
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-lg flex-1 px-4 py-6">
        {children}
      </main>
      <p className="no-print mx-auto w-full max-w-lg px-4 pb-8 text-sm text-ink-500">{COPY.notMedicalAdvice}</p>
    </div>
  );
}
