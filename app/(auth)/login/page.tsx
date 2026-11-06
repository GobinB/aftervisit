import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { COPY } from "@/lib/copy";
import { safeNext } from "@/lib/safe-next";
import { GoogleButton } from "./GoogleButton";

export const metadata: Metadata = { title: "Sign in", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  google: "Google sign-in did not complete. Try again.",
  expired: "Google sign-in took too long, so it stopped. Try again.",
  config: "Google sign-in is not set up yet.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; next?: string }> }) {
  const query = await searchParams;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  // With no return address, /start picks the circle: straight into it when there is one.
  const next = query.next ? safeNext(query.next, `${proto}://${host}`) : "/start";
  const message = query.error ? ERRORS[query.error] : undefined;
  return (
    <div className="flex min-h-dvh flex-col bg-surface-50">
      <main id="main" className="flex flex-1 flex-col items-center justify-center px-4 py-12">
        <Link href="/" className="rounded-lg" aria-label="All Hands Care home">
          <Logo />
        </Link>
        <div className="mt-8 w-full max-w-md rounded-2xl border border-border-200 bg-white p-6 sm:p-8">
          <h1 className="font-display text-center text-page text-primary-900">Sign in</h1>
          <p className="mt-3 text-center text-ink-500">Use the Google account you use for caregiving. There is no password and no email sign-in. You stay signed in on this device until you sign out.</p>
          {message ? (
            <p role="alert" className="mt-4 rounded-xl bg-attn-bg px-3 py-2 text-attn-ink">
              {message}
            </p>
          ) : null}
          <GoogleButton next={next} />
          <p className="mt-6 text-center">
            <Link href="/privacy" className="font-medium text-primary-700 underline decoration-primary-700/30 underline-offset-4 hover:text-primary-900">
              Privacy
            </Link>
          </p>
        </div>
      </main>
      <p className="mx-auto w-full max-w-md px-4 py-6 text-center text-sm text-ink-500">{COPY.notMedicalAdvice}</p>
    </div>
  );
}
