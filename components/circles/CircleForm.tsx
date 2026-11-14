"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createCircle } from "@/app/actions/circles";
import { Button } from "@/components/ui/Button";
import { personNameError } from "@/lib/circle-form";
import { CONSENT_TEXT, CONSENT_TYPES, type ConsentType } from "@/lib/schema/circles";

const field =
  "mt-1.5 w-full min-h-12 rounded-xl border border-border-200 bg-white px-3 text-base text-ink-900 outline-none focus:border-action-500";

/**
 * Starting a circle asks only for the person's name and the three statements. Allergies, doctors
 * and who to call are added later from cards on Today, whenever the caregiver has them to hand.
 */
export function CircleForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [name, setName] = useState("");
  const [consents, setConsents] = useState<Record<ConsentType, boolean>>({
    authorized_to_share: false,
    terms: false,
    privacy: false,
  });

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nameError = personNameError(name);
    if (nameError) {
      setError(nameError);
      return;
    }
    if (CONSENT_TYPES.some((type) => !consents[type])) {
      setError("Tick each statement to continue.");
      return;
    }
    setError(null);
    // Nothing about keys here: the key for files is made by itself the first time the circle needs it.
    start(async () => {
      try {
        const result = await createCircle({
          content: { person_name: name, allergies: [], doctors: [], emergency_contacts: [] },
          consents: { authorized_to_share: true, terms: true, privacy: true },
        });
        if (!result.ok) {
          setError(result.error);
          return;
        }
        router.push(`/circles/${result.circleId}`);
      } catch {
        setError("The circle could not be saved. Try again.");
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-7" noValidate>
      <div>
        <label htmlFor="person_name" className="text-[17px] font-semibold text-ink-900">
          Who are you caring for?
        </label>
        <input
          id="person_name"
          name="person_name"
          required
          autoComplete="off"
          aria-describedby="person_name-hint"
          className={field}
          value={name}
          placeholder="e.g. Mom, or Margaret Lee"
          onChange={(event) => {
            setName(event.target.value);
            if (error && !personNameError(event.target.value)) setError(null);
          }}
        />
        <p id="person_name-hint" className="mt-1 text-sm text-ink-500">
          Their name, not yours. Helpers see it at the top of the page.
        </p>
      </div>

      <fieldset className="space-y-3">
        <legend className="mb-2 text-[15px] font-semibold text-ink-900">Tick each one</legend>
        {CONSENT_TYPES.map((type) => (
          <label key={type} className="flex min-h-11 items-start gap-3 rounded-lg border border-border-200 bg-white p-3 text-ink-900 has-[:checked]:border-primary-700/50 has-[:checked]:bg-sky-100/50">
            <input
              type="checkbox"
              className="mt-0.5 h-6 w-6 shrink-0 accent-primary-700"
              checked={consents[type]}
              onChange={(event) => {
                const next = { ...consents, [type]: event.target.checked };
                setConsents(next);
                if (CONSENT_TYPES.every((item) => next[item]) && !personNameError(name)) setError(null);
              }}
            />
            <span>{CONSENT_TEXT[type]}</span>
          </label>
        ))}
      </fieldset>

      {error ? (
        <p role="alert" className="rounded-xl bg-attn-bg px-3 py-2 text-attn-ink">
          {error}
        </p>
      ) : null}
      <Button type="submit" className="w-full sm:w-auto sm:min-w-56" disabled={pending}>
        {pending ? "Starting" : "Start the circle"}
      </Button>
    </form>
  );
}
