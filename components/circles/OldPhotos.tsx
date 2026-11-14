"use client";

import { Lock } from "lucide-react";
import { useId, useState, useTransition } from "react";
import { openOldKeyWithWords, startFresh, type OldKey } from "@/components/circles/circle-key";

const primary = "inline-flex min-h-12 items-center justify-center rounded-lg bg-primary-700 px-4 text-[15px] font-semibold text-white hover:bg-primary-900 disabled:opacity-50";
const plain = "inline-flex min-h-12 items-center justify-center rounded-lg border border-border-200 bg-white px-4 text-[15px] font-semibold text-ink-900 hover:bg-paper-100 disabled:opacity-50";
const quiet = "inline-flex min-h-12 items-center justify-center rounded-lg px-4 text-[15px] font-semibold text-ink-500 hover:bg-paper-100 disabled:opacity-50";

/**
 * The one place recovery words are still mentioned. Shown only for a circle whose saved summaries
 * were locked with 12 words, on a device that does not have the key, when no other device has
 * handed it over. Two ways on: type the words once, or remove those summaries and start fresh.
 */
export function OldPhotos({ circleId, old, onReady }: { circleId: string; old: OldKey; onReady: () => void }) {
  const baseId = useId();
  const [view, setView] = useState<"choose" | "words" | "fresh">("choose");
  const [words, setWords] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const many = old.savedFiles !== 1;
  const them = many ? "them" : "it";

  function back() {
    setError(null);
    setView("choose");
  }

  function submitWords(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    start(async () => {
      const result = await openOldKeyWithWords(circleId, old, words);
      if (result.ok) {
        setWords("");
        onReady();
      } else {
        setError(result.reason === "failed" ? result.error : "Those words did not open the saved summaries.");
      }
    });
  }

  function removeAndStart() {
    setError(null);
    start(async () => {
      const result = await startFresh(circleId);
      if (result.ok) onReady();
      else setError(result.reason === "failed" ? result.error : "The saved summaries could not be removed. Try again.");
    });
  }

  return (
    <section aria-labelledby={`${baseId}-title`} className="max-w-xl rounded-lg border border-border-200 bg-white p-5">
      <Lock className="size-6 text-primary-700" aria-hidden="true" />
      <h2 id={`${baseId}-title`} className="mt-2 text-[16px] font-semibold text-ink-900">
        {many ? `${old.savedFiles} visit summaries saved before cannot be opened here` : "A visit summary saved before cannot be opened here"}
      </h2>
      <p className="mt-1 text-[14px] text-ink-500">
        {many ? "They were" : "It was"} locked with 12 words that were shown once and never stored by All Hands Care. Without those words nobody can open {them}.
        Medications, reminders and the calendar are not affected.
      </p>
      {error ? (
        <p role="alert" className="mt-3 rounded-md bg-attn-bg px-3 py-2 text-[14px] text-attn-ink">
          {error}
        </p>
      ) : null}

      {view === "choose" ? (
        <>
          <div className="mt-4 flex flex-wrap gap-2">
            {old.wrapped ? (
              <button type="button" className={plain} onClick={() => setView("words")}>
                I still have my words
              </button>
            ) : null}
            <button type="button" className={plain} onClick={() => setView("fresh")}>
              Start fresh
            </button>
          </div>
          <p className="mt-3 text-[13px] text-ink-500">
            Saved {them} on another phone or computer? Open All Hands Care there once, while signed in, and {many ? "they" : "it"} will open everywhere.
          </p>
        </>
      ) : null}

      {view === "words" ? (
        <form onSubmit={submitWords} className="mt-4 space-y-3">
          <div>
            <label htmlFor={`${baseId}-words`} className="text-[14px] font-medium text-ink-900">
              Your 12 words, with a space between each
            </label>
            <textarea
              id={`${baseId}-words`}
              value={words}
              onChange={(event) => setWords(event.target.value)}
              rows={3}
              required
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              maxLength={300}
              className="mt-1.5 min-h-24 w-full rounded-lg border border-border-200 bg-white px-3 py-2 text-[16px] text-ink-900 outline-none focus:border-action-500"
            />
            <p className="mt-1 text-[13px] text-ink-500">You only do this once. All Hands Care then keeps the key, so they open on any device when you sign in.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="submit" className={primary} disabled={pending} aria-busy={pending}>
              {pending ? "Opening" : "Open my saved summaries"}
            </button>
            <button type="button" className={quiet} onClick={back} disabled={pending}>
              Back
            </button>
          </div>
        </form>
      ) : null}

      {view === "fresh" ? (
        <div role="group" aria-label="Confirm start fresh" className="mt-4 space-y-3 rounded-lg border border-attn/30 p-4">
          <p className="text-[15px] text-ink-900">
            Remove {many ? `the ${old.savedFiles} saved summaries` : "the saved summary"} from before, for good? This cannot be undone. Everything else stays: medications,
            reminders, the calendar and the people who help. Photos you keep from now on open on any device when you sign in.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending}
              aria-busy={pending}
              onClick={removeAndStart}
              className="inline-flex min-h-12 items-center rounded-lg border-2 border-attn bg-white px-4 text-[15px] font-semibold text-attn-ink hover:bg-attn-bg disabled:opacity-50"
            >
              {pending ? "Removing" : `Yes, remove ${them} and start fresh`}
            </button>
            <button type="button" className={quiet} onClick={back} disabled={pending}>
              Back
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
