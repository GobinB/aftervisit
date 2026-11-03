import Link from "next/link";
import { Logo } from "@/components/Logo";
import { SignOut } from "@/components/circles/SignOut";
import { COPY } from "@/lib/copy";

/**
 * Frame for signed-in and helper screens. `narrow` suits one-column forms (sign-in, setup).
 * `signedIn` shows Sign out to a caregiver. Tokens come from the theme in app/globals.css.
 */
export function CircleShell({ children, signedIn = false, narrow = false }: { children: React.ReactNode; signedIn?: boolean; narrow?: boolean }) {
  const width = narrow ? "max-w-xl" : "max-w-5xl";
  return (
    <div className="flex min-h-dvh flex-col bg-white">
      <header className="no-print sticky top-0 z-30 h-16 border-b border-border-200 bg-white">
        <div className={`mx-auto flex h-full ${width} items-center justify-between px-4 sm:px-6`}>
          <Link href={signedIn ? "/circles" : "/"} className="rounded-lg" aria-label={signedIn ? "AfterVisit, your circles" : "AfterVisit home"}>
            <Logo />
          </Link>
          <nav aria-label="Account" className="flex items-center gap-1">
            <Link href="/privacy" className="rounded-lg px-2 py-2 font-medium text-ink-900/80 hover:text-primary-900">
              Privacy
            </Link>
            {signedIn ? <SignOut /> : null}
          </nav>
        </div>
      </header>
      <main id="main" className={`mx-auto w-full ${width} flex-1 px-4 pt-8 pb-14 sm:px-6 sm:pt-12`}>
        {children}
      </main>
      <p className={`no-print mx-auto w-full ${width} border-t border-border-200 px-4 py-6 text-sm text-ink-500 sm:px-6`}>{COPY.notMedicalAdvice}</p>
    </div>
  );
}
