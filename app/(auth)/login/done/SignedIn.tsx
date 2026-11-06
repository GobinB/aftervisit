"use client";

import { CheckCircle2 } from "lucide-react";
import { useEffect } from "react";
import { SIGNED_IN_CHANNEL } from "../GoogleButton";

/**
 * Tells the app's main window that sign-in finished, then closes this window. If it was not opened
 * by the app (or iOS will not close it), it goes on to the circle itself, so nobody is left here.
 */
export function SignedIn({ next }: { next: string }) {
  useEffect(() => {
    try {
      const channel = new BroadcastChannel(SIGNED_IN_CHANNEL);
      channel.postMessage("signed-in");
      channel.close();
    } catch {}
    try {
      window.opener?.postMessage(SIGNED_IN_CHANNEL, window.location.origin);
    } catch {}
    const hadOpener = Boolean(window.opener);
    if (hadOpener) window.close();
    const timer = window.setTimeout(() => window.location.replace(next), hadOpener ? 600 : 0);
    return () => window.clearTimeout(timer);
  }, [next]);
  return (
    <main id="main" className="flex min-h-dvh flex-col items-center justify-center bg-surface-50 px-4 text-center">
      <CheckCircle2 className="size-10 text-ok" aria-hidden="true" />
      <h1 className="font-display mt-3 text-[26px] text-primary-900">You are signed in</h1>
      <p className="mt-2 text-ink-500">Taking you to your circle.</p>
    </main>
  );
}
