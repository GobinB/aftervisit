"use client";

import { Lock } from "lucide-react";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { ensureCircleKey, openOldKeyWithWords, startFresh, type OldKey } from "@/components/circles/circle-key";

const primary = "inline-flex min-h-12 items-center justify-center rounded-lg bg-primary-700 px-4 text-[15px] font-semibold text-white hover:bg-primary-900 disabled:opacity-50";
const plain = "inline-flex min-h-12 items-center justify-center rounded-lg border border-border-200 bg-white px-4 text-[15px] font-semibold text-ink-900 hover:bg-paper-100 disabled:opacity-50";
const quiet = "inline-flex min-h-12 items-center justify-center rounded-lg px-4 text-[15px] font-semibold text-ink-500 hover:bg-paper-100 disabled:opacity-50";

/** How often this panel may ask again by itself when the caregiver comes back to the page. */
const RECHECK_MS = 20_000;

/**
 * The one place recovery words are still mentioned. Shown only for a circle whose saved summaries
 * were locked with 12 words, on a device that does not have the key, when no other device has
 * handed it over. Three ways on: open All Hands Care on a device that still has the key (this
 * panel then goes away by itself), type the words once, or remove those summaries and start fresh.
 *
 * Starting fresh cannot be undone, and this device cannot know whether another one still has the
 * key. So it takes two steps and a tick that says no other device opens them and the words are gone.
 */
export function OldPhotos({ circleId, old, onReady }: { circleId: string; old: OldKey; onReady: () => void }) {
  const baseId = useId();
  const [view, setView] = useState<"choose" | "words" | "fresh">("choose");
  const [words, setWords] = useState("");
  const [sure, setSure] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const lastCheck = useRef(0);
  const many = old.savedFiles !== 1;
  const them = many ? "them" : "it";
  const they = many ? "they" : "it";

  // Another device may have handed the key over while this page sat open. Look again when the caregiver returns to it.
  useEffect(() => {
    let cancel = false;
    const look = () => {
      if (document.visibilityState !== "visible" || Date.now() - lastCheck.current < RECHECK_MS) return;
      lastCheck.current = Date.now();
      ensureCircleKey(circleId).then((result) => {
        if (!cancel && result.ok) onReady();
      });
    };
    document.addEventListener("visibilitychange", look);
    window.addEventListener("focus", look);
    return () => {
      cancel = true;
      document.removeEventListener("visibilitychange", look);
      window.removeEventListener("focus", look);
    };
  }, [circleId, onReady]);

  function back() {
    setError(null);
    setSure(false);
    setView("choose");
  }

  function checkAgain() {
    setError(null);
    setNote(null);
    lastCheck.current = Date.now();
    start(async () => {
      const result = await ensureCircleKey(circleId);
      if (result.ok) onReady();
      else if (result.reason === "failed") setError(result.error);
      else setNote(`Still locked. Open All Hands Care on the other phone or computer first, signed in, then press "Check again" here.`);
    });
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
    if (!sure) return;
    setError(null);
    start(async () => {
      // One last look: if another device handed the key over a moment ago, nothing is removed.
      const now = await ensureCircleKey(circleId);
      if (now.ok) {
        onReady();
        return;
      }
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
          <div className="mt-4 rounded-lg bg-sky-100 px-4 py-3">
            <p className="text-[14px] font-semibold text-primary-900">First, try the phone or computer where you saved or opened {them}.</p>
            <p className="mt-1 text-[14px] text-ink-900">
              Open All Hands Care there, signed in. That is all: {they} will then open everywhere, with nothing to type.
            </p>
            <button type="button" className="mt-2 inline-flex min-h-11 items-center rounded-lg text-[15px] font-semibold text-primary-700 underline underline-offset-2 disabled:opacity-50" onClick={checkAgain} disabled={pending} aria-busy={pending}>
              {pending ? "Checking" : "Check again"}
            </button>
            {note ? (
              <p role="status" className="mt-1 text-[14px] text-ink-900">
                {note}
              </p>
            ) : null}
          </div>
          <p className="mt-4 text-[14px] text-ink-500">If that is not possible:</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {old.wrapped ? (
              <button type="button" className={plain} onClick={() => setView("words")}>
                I still have my words
              </button>
            ) : null}
            <button type="button" className={plain} onClick={() => setView("fresh")}>
              Start fresh
            </button>
          </div>
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
            This removes {many ? `the ${old.savedFiles} saved summaries` : "the saved summary"} from before, for good. It cannot be undone. Everything else stays: medications,
            reminders, the calendar and the people who help.
          </p>
          <p className="text-[15px] text-ink-900">
            If any phone or computer of yours might still open {them}, go back and try it first. Once {they} {many ? "are" : "is"} removed, that device cannot bring {them} back.
          </p>
          <label className="flex min-h-12 items-start gap-3 rounded-lg border border-border-200 bg-white p-3 text-[15px] text-ink-900">
            <input type="checkbox" className="mt-1 size-5 accent-primary-700" checked={sure} onChange={(event) => setSure(event.target.checked)} disabled={pending} />
            <span>No phone or computer of mine still opens {them}, and I do not have the 12 words.</span>
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending || !sure}
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
