"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { signInWithGoogle } from "./actions";

export const SIGNED_IN_CHANNEL = "ahc-signed-in";

/** True inside an app added to the iPhone or iPad Home Screen. */
function inIosHomeScreenApp(): boolean {
  if (typeof window === "undefined") return false;
  const standalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return standalone;
}

/** How long a closed Google window gets for its "signed in" message to arrive before the button comes back. */
const CLOSED_GRACE_MS = 1500;

/**
 * The Google button. In a browser it is a normal form post. In the installed iPhone app, Google
 * would otherwise open in a Safari sheet whose cookies the app never sees, so the button opens
 * Google in a window of the app itself and waits for /login/done to say the sign-in finished.
 * If that window closes without finishing (closed by hand, or Google's sign-in ran out of time),
 * the button comes back with a line saying so, and "Start again" is always there while it waits.
 * The page keeps listening either way, so a sign-in that does finish still moves it on.
 */
export function GoogleButton({
  next,
  label = "Sign in with Google",
  chooseAccount = false,
  variant = "primary",
  className = "mt-8",
}: {
  next: string;
  label?: string;
  /** Google shows its list of accounts instead of reusing the one already signed in. */
  chooseAccount?: boolean;
  variant?: "primary" | "secondary";
  className?: string;
}) {
  // `attempt`: counts Google windows opened; above 0, the page waits for a sign-in. `waiting`: the
  // button shows "Finishing sign-in". The window closing ends `waiting` only.
  const [attempt, setAttempt] = useState(0);
  const [waiting, setWaiting] = useState(false);
  const [closedEarly, setClosedEarly] = useState(false);
  const popup = useRef<Window | null>(null);

  useEffect(() => {
    if (attempt === 0) return;
    let gone = false;
    const go = () => {
      if (!gone) {
        gone = true;
        window.location.replace(next);
      }
    };
    const check = async () => {
      // Switching accounts: this browser is already signed in (as the other account), so only the
      // message from /login/done means the new sign-in finished.
      if (chooseAccount) return;
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
    // The button comes back once the Google window has been seen open and then closed, after a short
    // wait for its message. Seen open first, so a browser that reports it closed from the start
    // never cuts a sign-in short. After that the timed session check stops; the message and focus
    // listeners stay, so a sign-in that still finishes moves the page on.
    let seenOpen = false;
    let graceTimer = 0;
    const watch = window.setInterval(() => {
      let closed: boolean;
      try {
        closed = popup.current?.closed ?? true;
      } catch {
        return;
      }
      if (!closed) {
        seenOpen = true;
        return;
      }
      if (!seenOpen || graceTimer) return;
      window.clearInterval(watch);
      graceTimer = window.setTimeout(() => {
        if (gone) return;
        window.clearInterval(timer);
        setWaiting(false);
        setClosedEarly(true);
      }, CLOSED_GRACE_MS);
    }, 500);
    return () => {
      channel?.close();
      window.removeEventListener("message", onMessage);
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(timer);
      window.clearInterval(watch);
      window.clearTimeout(graceTimer);
    };
  }, [attempt, next, chooseAccount]);

  const startAgain = () => {
    try {
      popup.current?.close();
    } catch {}
    popup.current = null;
    setWaiting(false);
    setAttempt(0);
    setClosedEarly(false);
  };

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    if (!inIosHomeScreenApp()) return;
    event.preventDefault();
    const url = `/login/google?app=1&next=${encodeURIComponent(next)}${chooseAccount ? "&choose=1" : ""}`;
    // Opened straight from the tap, so iOS allows it and keeps it inside the app.
    const opened = window.open(url, "_blank");
    setClosedEarly(false);
    if (!opened) {
      // A full page load on purpose: /login/google is a route handler that sends the browser on to Google.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = url;
      return;
    }
    popup.current = opened;
    // A new window restarts the watch, even if the page was still listening for an earlier one.
    setAttempt((n) => n + 1);
    setWaiting(true);
  };

  return (
    <form action={signInWithGoogle} onSubmit={onSubmit} className={className}>
      <input type="hidden" name="next" value={next} />
      {chooseAccount ? <input type="hidden" name="choose" value="1" /> : null}
      <Button type="submit" variant={variant} className="w-full" disabled={waiting}>
        {waiting ? <Loader2 className="size-5 animate-spin" aria-hidden="true" /> : null}
        {waiting ? "Finishing sign-in" : label}
      </Button>
      {waiting ? (
        <div className="mt-3 text-center">
          <p role="status" className="text-hint text-ink-500">
            Finish with Google in the window that opened. This page moves on by itself when you are signed in.
          </p>
          <button type="button" onClick={startAgain} className="mt-1 min-h-11 px-3 text-label font-semibold text-primary-700 underline underline-offset-4">
            Start again
          </button>
        </div>
      ) : closedEarly ? (
        <p role="status" className="mt-3 text-center text-hint text-ink-500">
          The Google window closed before sign-in finished. Tap the button to try again.
        </p>
      ) : null}
    </form>
  );
}
