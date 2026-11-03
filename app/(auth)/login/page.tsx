import type { Metadata } from "next";
import { headers } from "next/headers";
import { Button } from "@/components/ui/Button";
import { CircleShell } from "@/components/circles/Shell";
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
    <CircleShell narrow>
      <h1 className="font-display text-page text-primary-900">Sign in</h1>
      <p className="mt-3 text-ink-500">Use the Google account you use for caregiving. There is no password and no email sign-in.</p>
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
    </CircleShell>
  );
}
