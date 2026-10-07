"use client";
import Link from "next/link";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <main id="main" className="mx-auto max-w-[640px] px-4 py-20 text-center">
      <h1 className="font-display text-2xl font-medium text-primary-900">Something went wrong on our side</h1>
      <p className="mt-2 text-ink-500">Your draft is still saved in this tab. Please try again.</p>
      <div className="mt-6 flex justify-center gap-3">
        <button type="button" onClick={reset} className="min-h-12 rounded-xl bg-primary-700 px-5 font-semibold text-white">
          Try again
        </button>
        <Link href="/" className="inline-flex min-h-12 items-center rounded-xl px-5 font-semibold text-primary-700">
          Home
        </Link>
      </div>
    </main>
  );
}
