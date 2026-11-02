import type { Metadata } from "next";
import { Button } from "@/components/ui/Button";
import { CircleShell } from "@/components/circles/Shell";
import { signInWithGoogle } from "./actions";

export const metadata: Metadata = { title: "Sign in", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  google: "Google sign-in did not complete. Try again.",
  config: "Google sign-in is not set up yet.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; next?: string }> }) {
  const query = await searchParams;
  const next = query.next?.startsWith("/") && !query.next.startsWith("//") ? query.next : "/circles";
  const message = query.error ? ERRORS[query.error] : undefined;
  return (
    <CircleShell>
      <h1 className="font-display text-[2rem] leading-tight text-primary-900">Sign in</h1>
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
