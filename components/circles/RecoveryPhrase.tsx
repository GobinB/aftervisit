"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { confirmationIndexes, normalizePhrase } from "@/lib/crypto";

const field =
  "mt-1.5 w-full min-h-12 rounded-xl border border-border-200 bg-white px-3 text-base text-ink-900 outline-none focus:border-action-500";

/** Shows the recovery words once and asks for three of them before the circle is saved. */
export function RecoveryPhrase({
  words,
  pending,
  error,
  onConfirm,
  onBack,
}: {
  words: readonly string[];
  pending: boolean;
  error: string | null;
  onConfirm: () => void;
  onBack: () => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  const baseId = useId();
  const [indexes] = useState(() => confirmationIndexes(words.length));
  const [typed, setTyped] = useState<string[]>(() => indexes.map(() => ""));
  const [mismatch, setMismatch] = useState<string | null>(null);

  useEffect(() => {
    heading.current?.focus();
  }, []);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const matches = indexes.every((wordIndex, index) => normalizePhrase(typed[index] ?? "") === words[wordIndex]);
    if (!matches) {
      setMismatch("Those words do not match. Check the numbered list and try again.");
      return;
    }
    setMismatch(null);
    onConfirm();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <h2 ref={heading} tabIndex={-1} className="font-display text-page text-primary-900">
        Write down these words
      </h2>
      <p id={`${baseId}-warning`}>
        Write these 12 words on paper and keep them somewhere safe. This is the only way to open files from this circle on a new phone or computer. If every caregiver loses the words, the files cannot be recovered. AfterVisit cannot look them up.
      </p>
      <ol className="grid gap-2" aria-describedby={`${baseId}-warning`}>
        {words.map((word, index) => (
          <li key={index} className="flex min-h-12 items-center gap-3 rounded-xl border border-border-200 bg-white px-3">
            <span className="w-8 text-ink-500">{index + 1}</span>
            <span className="font-semibold text-ink-900">{word}</span>
          </li>
        ))}
      </ol>
      <fieldset className="space-y-3">
        <legend className="font-medium text-ink-900">Type three words to confirm you saved them</legend>
        {indexes.map((wordIndex, index) => {
          const id = `${baseId}-word-${wordIndex}`;
          return (
            <div key={wordIndex}>
              <label htmlFor={id} className="font-medium text-ink-900">
                Word {wordIndex + 1}
              </label>
              <input
                id={id}
                value={typed[index] ?? ""}
                onChange={(event) => {
                  const next = typed.slice();
                  next[index] = event.target.value;
                  setTyped(next);
                }}
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                className={field}
                required
              />
            </div>
          );
        })}
      </fieldset>
      {mismatch || error ? (
        <p role="alert" className="rounded-xl bg-attn-bg px-3 py-2 text-attn-ink">
          {mismatch ?? error}
        </p>
      ) : null}
      <Button type="submit" className="w-full" disabled={pending} aria-busy={pending}>
        {pending ? "Saving" : "I saved the words"}
      </Button>
      <Button variant="secondary" className="w-full" onClick={onBack} disabled={pending}>
        Back
      </Button>
      <p className="text-sm text-ink-500">Going back throws these words away. New words are created if you continue again.</p>
    </form>
  );
}
