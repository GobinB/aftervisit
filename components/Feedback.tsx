"use client";
import { MessageCircleHeart } from "lucide-react";
import { useId, useState } from "react";
import { COPY } from "@/lib/copy";

const EASIER = [
  ["yes", "Yes"],
  ["somewhat", "Somewhat"],
  ["no", "No"],
] as const;

/**
 * Three questions for caregivers. Answers are stored anonymously: no handoff link, no IP,
 * and people are asked not to include names or health details.
 */
export function FeedbackCard({ context }: { context: "demo" | "manage" }) {
  const [easier, setEasier] = useState<string>("");
  const [stillNeed, setStillNeed] = useState("");
  const [whoElse, setWhoElse] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const id = useId();

  if (done) {
    return (
      <section className="rounded-2xl border border-border-200 bg-white p-5" role="status">
        <p className="font-semibold text-ink-900">Thank you. This helps decide what to build next.</p>
      </section>
    );
  }

  return (
    <section aria-labelledby={`${id}-t`} className="rounded-2xl border border-border-200 bg-white p-5">
      <h2 id={`${id}-t`} className="flex items-center gap-2 text-lg font-semibold text-primary-700">
        <MessageCircleHeart size={20} aria-hidden="true" /> Help improve AfterVisit
      </h2>
      <p className="mt-1 text-sm text-ink-500">Three optional questions. Please don&apos;t include names or health details.</p>
      <form
        className="mt-4 space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setError(null);
          if (!consent) return setError("Please tick the box to agree to share your answers.");
          setBusy(true);
          try {
            const res = await fetch("/api/feedback", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ context, easier: easier || undefined, stillNeed: stillNeed || undefined, whoElse: whoElse || undefined, consent: true }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.message || COPY.genericError);
            setDone(true);
          } catch (err) {
            setError(err instanceof Error ? err.message : COPY.genericError);
          } finally {
            setBusy(false);
          }
        }}
      >
        <fieldset>
          <legend className="font-medium">Would this make sharing appointment information easier?</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {EASIER.map(([v, label]) => (
              <label
                key={v}
                className={`flex min-h-10 cursor-pointer items-center gap-2 rounded-full px-3.5 text-sm font-medium ring-1 ${
                  easier === v ? "bg-sky-100 text-primary-900 ring-action-500" : "bg-white ring-border-200"
                }`}
              >
                <input type="radio" name={`${id}-easier`} value={v} checked={easier === v} onChange={() => setEasier(v)} className="sr-only" />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
        <div>
          <label htmlFor={`${id}-need`} className="font-medium">
            What would you still need to call or text someone about?
          </label>
          <textarea
            id={`${id}-need`}
            rows={2}
            maxLength={500}
            value={stillNeed}
            onChange={(e) => setStillNeed(e.target.value)}
            className="mt-1 w-full rounded-lg border border-border-200 bg-white p-3 outline-none focus:border-action-500 focus:ring-2 focus:ring-action-500/30"
          />
        </div>
        <div>
          <label htmlFor={`${id}-who`} className="font-medium">
            Who else would need this update?
          </label>
          <input
            id={`${id}-who`}
            maxLength={500}
            value={whoElse}
            onChange={(e) => setWhoElse(e.target.value)}
            placeholder="For example: a pharmacist, a neighbor who drives"
            className="mt-1 h-11 w-full rounded-lg border border-border-200 bg-white px-3 outline-none focus:border-action-500 focus:ring-2 focus:ring-action-500/30"
          />
        </div>
        <label className="flex cursor-pointer gap-3 text-[0.95rem]">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-primary-700" />
          <span>I agree AfterVisit can store these answers anonymously to improve the product.</span>
        </label>
        {error ? (
          <p role="alert" className="text-sm text-attn-ink">
            {error}
          </p>
        ) : null}
        <button type="submit" disabled={busy} className="min-h-11 rounded-lg bg-primary-700 px-4 font-semibold text-white disabled:opacity-60">
          {busy ? "Sending…" : "Send feedback"}
        </button>
      </form>
    </section>
  );
}
