"use client";

import { useEffect, useId, useState, useTransition } from "react";
import { storeCircleKey } from "@/app/actions/circles";
import { RecoveryPhrase } from "@/components/circles/RecoveryPhrase";
import { Button } from "@/components/ui/Button";
import { generateCircleKey, generatePhrase, loadCircleKey, saveCircleKey, unwrapCircleKey, wrapCircleKey } from "@/lib/crypto";
import type { CircleKeyStatus } from "@/lib/schema/circles";

const field =
  "mt-1.5 w-full min-h-12 rounded-xl border border-border-200 bg-white px-3 text-base text-ink-900 outline-none focus:border-action-500";

/** After sign-in, ask for the recovery words when this browser has no matching circle key. */
export function RestoreKeys({ circles }: { circles: CircleKeyStatus[] }) {
  const [needed, setNeeded] = useState<CircleKeyStatus[] | null>(null);
  const stamp = circles.map((circle) => `${circle.circleId}:${circle.circleKeyVersion}:${circle.wrappedKeyVersion}:${circle.wrapped ? "1" : "0"}`).join("|");

  useEffect(() => {
    let cancel = false;
    (async () => {
      const missing: CircleKeyStatus[] = [];
      for (const circle of circles) {
        if (!circle.wrapped || circle.wrappedKeyVersion !== circle.circleKeyVersion) {
          missing.push(circle);
          continue;
        }
        try {
          const local = await loadCircleKey(circle.circleId);
          if (!local || local.keyVersion !== circle.circleKeyVersion) missing.push(circle);
        } catch {
          missing.push(circle);
        }
      }
      if (!cancel) setNeeded(missing);
    })();
    return () => {
      cancel = true;
    };
    // The stamp is the circle key status. The array identity changes on each server render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stamp]);

  if (!needed?.length) return null;

  return (
    <div className="mt-6 space-y-4">
      {needed.map((circle) => (
        <RestoreOne key={circle.circleId} circle={circle} onDone={() => setNeeded(needed.filter((item) => item.circleId !== circle.circleId))} />
      ))}
    </div>
  );
}

function RestoreOne({ circle, onDone }: { circle: CircleKeyStatus; onDone: () => void }) {
  if (!circle.wrapped) {
    if (circle.role === "owner" && circle.circleKeyVersion === 1) return <CreateFirstKey circle={circle} onDone={onDone} />;
    return (
      <p className="rounded-2xl border border-border-200 bg-white p-4 text-ink-900" role="status">
        {circle.personName} does not have a key saved on your account yet. Another caregiver holds the recovery words. Sharing that key with you is not ready yet.
      </p>
    );
  }
  if (circle.wrappedKeyVersion !== circle.circleKeyVersion) {
    return (
      <p className="rounded-2xl border border-border-200 bg-white p-4 text-ink-900" role="status">
        The key for {circle.personName} was changed on another account. Your recovery words still open the previous key. Files saved after that change cannot be opened here until the new key can be shared. That step is not ready yet.
      </p>
    );
  }
  return <EnterPhrase circle={circle} onDone={onDone} />;
}

function EnterPhrase({ circle, onDone }: { circle: CircleKeyStatus; onDone: () => void }) {
  const baseId = useId();
  const [phrase, setPhrase] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!circle.wrapped) return;
    const wrapped = circle.wrapped;
    start(async () => {
      try {
        const key = await unwrapCircleKey(wrapped, phrase);
        await saveCircleKey(circle.circleId, key, circle.circleKeyVersion);
        setPhrase("");
        setDone(true);
        onDone();
      } catch (caught) {
        const message = caught instanceof Error && /not a recovery phrase|did not open/.test(caught.message) ? caught.message : "Those words did not open the key.";
        setError(message);
      }
    });
  }

  if (done) return <p role="status">Key saved on this device for {circle.personName}.</p>;

  return (
    <form onSubmit={submit} className="space-y-3 rounded-2xl border border-border-200 bg-white p-4">
      <h2 className="font-display text-section text-primary-900">Recovery words for {circle.personName}</h2>
      <p>This browser does not have the key for this circle. Enter the 12 words. They stay on this device. All Hands Care does not receive them.</p>
      <div>
        <label htmlFor={`${baseId}-phrase`} className="font-medium text-ink-900">
          Recovery words
        </label>
        <textarea
          id={`${baseId}-phrase`}
          value={phrase}
          onChange={(event) => setPhrase(event.target.value)}
          rows={4}
          required
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={300}
          className={`${field} min-h-24 py-2`}
        />
      </div>
      {error ? (
        <p role="alert" className="rounded-xl bg-attn-bg px-3 py-2 text-attn-ink">
          {error}
        </p>
      ) : null}
      <Button type="submit" className="w-full" disabled={pending} aria-busy={pending}>
        {pending ? "Checking" : "Save the key on this device"}
      </Button>
    </form>
  );
}

function CreateFirstKey({ circle, onDone }: { circle: CircleKeyStatus; onDone: () => void }) {
  const [words, setWords] = useState<string[] | null>(null);
  const [key, setKey] = useState<CryptoKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function begin() {
    start(async () => {
      try {
        const nextKey = await generateCircleKey();
        const phrase = await generatePhrase();
        setKey(nextKey);
        setWords(phrase.split(" "));
        setError(null);
      } catch {
        setError("The key could not be created in this browser. Try again.");
      }
    });
  }

  function confirm() {
    if (!words || !key) return;
    start(async () => {
      try {
        const circleKeyWrapped = await wrapCircleKey(key, words.join(" "));
        const result = await storeCircleKey({ circleId: circle.circleId, circleKeyWrapped, keyVersion: circle.circleKeyVersion });
        if (!result.ok) {
          setError(result.error);
          return;
        }
        try {
          await saveCircleKey(circle.circleId, key, circle.circleKeyVersion);
        } catch {
          setError("The key was saved on your account, but this browser could not keep it. Leave only after the words are written down, then enter them again from your circles.");
          return;
        }
        onDone();
      } catch {
        setError("The key could not be saved. The words are still on this page. Try again.");
      }
    });
  }

  if (words) {
    return (
      <RecoveryPhrase
        words={words}
        pending={pending}
        error={error}
        onConfirm={confirm}
        onBack={() => {
          setWords(null);
          setKey(null);
          setError(null);
        }}
      />
    );
  }

  return (
    <div className="space-y-3 rounded-2xl border border-border-200 bg-white p-4">
      <h2 className="font-display text-section text-primary-900">Key for {circle.personName}</h2>
      <p>This circle does not have a key for files yet. Create one on this device and write down the words. All Hands Care does not receive the words.</p>
      {error ? (
        <p role="alert" className="rounded-xl bg-attn-bg px-3 py-2 text-attn-ink">
          {error}
        </p>
      ) : null}
      <Button className="w-full" disabled={pending} onClick={begin}>
        {pending ? "Creating" : "Create a key"}
      </Button>
    </div>
  );
}
