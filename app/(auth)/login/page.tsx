import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Logo } from "@/components/Logo";
import { COPY } from "@/lib/copy";
import { safeNext } from "@/lib/safe-next";
import { signInWithGoogle } from "./actions";

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
  const next = safeNext(query.next, `${proto}://${host}`);
  const message = query.error ? ERRORS[query.error] : undefined;
  return (
    <div className="flex min-h-dvh flex-col bg-surface-50">
      <main id="main" className="flex flex-1 flex-col items-center justify-center px-4 py-12">
        <Link href="/" className="rounded-lg" aria-label="All Hands Care home">
          <Logo />
        </Link>
        <div className="mt-8 w-full max-w-md rounded-2xl border border-border-200 bg-white p-6 sm:p-8">
          <h1 className="font-display text-center text-page text-primary-900">Sign in</h1>
          <p className="mt-3 text-center text-ink-500">Use the Google account you use for caregiving. There is no password and no email sign-in.</p>
          {message ? (
            <p role="alert" className="mt-4 rounded-xl bg-attn-bg px-3 py-2 text-attn-ink">
              {message}
            </p>
          ) : null}
          <form action={signInWithGoogle} className="mt-8">
            <input type="hidden" name="next" value={next} />
            <Button type="submit" className="w-full">
              Sign in with Google
            </Button>
          </form>
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
