"use client";

import { Share, SquarePlus, Smartphone, X } from "lucide-react";
import { useEffect, useState } from "react";

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

const DISMISSED_KEY = "ahc-install-dismissed";

function isInstalled(): boolean {
  const standalone = window.matchMedia?.("(display-mode: standalone)").matches;
  return Boolean(standalone || (navigator as Navigator & { standalone?: boolean }).standalone);
}

function isIos(): boolean {
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
}

function wasDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * "Put it on your home screen." Android and desktop Chrome get the browser's own install prompt.
 * iPhone has no prompt, so it shows the two taps. Hidden once installed or dismissed.
 */
export function InstallApp() {
  const [mode, setMode] = useState<"hidden" | "prompt" | "ios">("hidden");
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);

  useEffect(() => {
    if (isInstalled() || wasDismissed()) return;
    if (isIos()) {
      setMode("ios");
      return;
    }
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPrompt);
      setMode("prompt");
    };
    const onInstalled = () => setMode("hidden");
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (mode === "hidden") return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISSED_KEY, "1");
    } catch {}
    setMode("hidden");
  };

  const install = async () => {
    if (!prompt) return;
    await prompt.prompt();
    const choice = await prompt.userChoice;
    setPrompt(null);
    if (choice.outcome === "accepted") setMode("hidden");
  };

  return (
    <section aria-label="Install the app" className="no-print mb-8 flex items-start gap-4 rounded-2xl border border-border-200 bg-white p-4 sm:p-5">
      <Smartphone size={28} className="mt-0.5 shrink-0 text-primary-700" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <h2 className="font-display text-lg font-medium text-primary-900">Put it on your home screen</h2>
        {mode === "prompt" ? (
          <>
            <p className="mt-1 text-ink-500">Opens like an app, one tap away.</p>
            <button type="button" onClick={install} className="mt-3 min-h-11 rounded-xl bg-primary-700 px-4 py-2 font-semibold text-white hover:bg-primary-900">
              Install
            </button>
          </>
        ) : (
          <ol className="mt-2 space-y-2 text-ink-900">
            <li className="flex items-center gap-2">
              <span className="font-semibold">1.</span> Tap <Share size={18} className="text-primary-700" aria-label="Share" /> Share
            </li>
            <li className="flex items-center gap-2">
              <span className="font-semibold">2.</span> Tap <SquarePlus size={18} className="text-primary-700" aria-hidden="true" /> Add to Home Screen
            </li>
          </ol>
        )}
      </div>
      <button type="button" onClick={dismiss} aria-label="Not now" className="-m-2 rounded-lg p-2 text-ink-500 hover:text-primary-900">
        <X size={20} aria-hidden="true" />
      </button>
    </section>
  );
}
