"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { signInWithGoogle } from "./actions";

export const SIGNED_IN_CHANNEL = "ahc-signed-in";

/** True inside an app added to the iPhone or iPad Home Screen. */
function inIosHomeScreenApp(): boolean {
  if (typeof window === "undefined") return false;
  const standalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return standalone;
}

/**
 * The Google button. In a browser it is a normal form post. In the installed iPhone app, Google
 * would otherwise open in a Safari sheet whose cookies the app never sees, so the button opens
 * Google in a window of the app itself and waits for /login/done to say the sign-in finished.
 */
export function GoogleButton({ next }: { next: string }) {
  const [waiting, setWaiting] = useState(false);

  useEffect(() => {
    if (!waiting) return;
    let gone = false;
    const go = () => {
      if (!gone) {
        gone = true;
        window.location.replace(next);
      }
    };
    const check = async () => {
      try {
        const res = await fetch("/api/session", { cache: "no-store" });
        const body = (await res.json()) as { signedIn?: boolean };
        if (body.signedIn) go();
      } catch {}
    };
    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel(SIGNED_IN_CHANNEL);
      channel.onmessage = () => go();
    } catch {}
    const onMessage = (event: MessageEvent) => {
      if (event.origin === window.location.origin && event.data === SIGNED_IN_CHANNEL) go();
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") void check();
    };
    window.addEventListener("message", onMessage);
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    const timer = window.setInterval(check, 2500);
    return () => {
      channel?.close();
      window.removeEventListener("message", onMessage);
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(timer);
    };
  }, [waiting, next]);

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    if (!inIosHomeScreenApp()) return;
    event.preventDefault();
    const url = `/login/google?app=1&next=${encodeURIComponent(next)}`;
    // Opened straight from the tap, so iOS allows it and keeps it inside the app.
    const opened = window.open(url, "_blank");
    if (!opened) {
      window.location.href = url;
      return;
    }
    setWaiting(true);
  };

  return (
    <form action={signInWithGoogle} onSubmit={onSubmit} className="mt-8">
      <input type="hidden" name="next" value={next} />
      <Button type="submit" className="w-full" disabled={waiting}>
        {waiting ? <Loader2 className="size-5 animate-spin" aria-hidden="true" /> : null}
        {waiting ? "Finishing sign-in" : "Sign in with Google"}
      </Button>
      {waiting ? (
        <p role="status" className="mt-3 text-center text-[14px] text-ink-500">
          Finish with Google in the window that opened. This page moves on by itself when you are signed in.
        </p>
      ) : null}
    </form>
  );
}
