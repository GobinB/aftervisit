import type { Metadata } from "next";
import { WifiOff } from "lucide-react";
import { Logo } from "@/components/Logo";

export const metadata: Metadata = { title: "No connection", robots: { index: false, follow: false } };

/** Shown by the service worker when a page cannot load. It holds no care details. */
export default function OfflinePage() {
  return (
    <main id="main" className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-surface-50 px-4 text-center">
      <Logo size={44} />
      <WifiOff size={40} className="text-primary-700" aria-hidden="true" />
      <h1 className="font-display text-heading text-primary-900">No connection</h1>
      <p className="max-w-sm text-ink-500">Your circle opens again when the phone is back online.</p>
      <a href="/start" className="rounded-xl bg-primary-700 px-5 py-3 font-semibold text-white hover:bg-primary-900">
        Try again
      </a>
    </main>
  );
}
