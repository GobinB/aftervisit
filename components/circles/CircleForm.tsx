"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createCircle } from "@/app/actions/circles";
import { RecoveryPhrase } from "@/components/circles/RecoveryPhrase";
import { Button } from "@/components/ui/Button";
import { generateCircleKey, generatePhrase, saveCircleKey, wrapCircleKey } from "@/lib/crypto";
import { CONSENT_TEXT, CONSENT_TYPES, type CircleContent, type ConsentType } from "@/lib/schema/circles";

const field =
  "mt-1.5 w-full min-h-12 rounded-xl border border-border-200 bg-white px-3 text-base text-ink-900 outline-none focus:border-action-500";

type Row = { name: string; extra: string; phone: string };

const STEPS = ["Who", "Care summary", "Agree", "Recovery words"] as const;

const empty = (): Row => ({ name: "", extra: "", phone: "" });

function lines(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

type Draft = {
  content: CircleContent;
  consents: { authorized_to_share: true; terms: true; privacy: true };
};

export function CircleForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [doctors, setDoctors] = useState<Row[]>([empty()]);
  const [contacts, setContacts] = useState<Row[]>([empty()]);
  const [consents, setConsents] = useState<Record<ConsentType, boolean>>({
    authorized_to_share: false,
    terms: false,
    privacy: false,
  });
  const [draft, setDraft] = useState<Draft | null>(null);
  const [phrase, setPhrase] = useState<string[] | null>(null);
  const [circleKey, setCircleKey] = useState<CryptoKey | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);
  const shown = phrase ? 3 : step;

  // Move focus to the new step's title so a screen reader hears where it is.
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    heading.current?.focus();
  }, [shown]);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (step === 0) {
      if (!String(form.get("person_name") ?? "").trim()) {
        setError("Enter the name of the person you care for.");
        return;
      }
      setError(null);
      setStep(1);
      return;
    }
    if (step === 1) {
      setError(null);
      setStep(2);
      return;
    }
    if (CONSENT_TYPES.some((type) => !consents[type])) {
      setError("Confirm each statement to continue.");
      return;
    }
    const pharmacyName = String(form.get("pharmacy_name") ?? "").trim();
    const poa = String(form.get("poa_location") ?? "").trim();
    const content: CircleContent = {
      person_name: String(form.get("person_name") ?? ""),
      allergies: lines(String(form.get("allergies") ?? "")),
      doctors: doctors
        .filter((row) => row.name.trim())
        .map((row) => ({ name: row.name.trim(), specialty: row.extra.trim() || undefined, phone: row.phone.trim() || undefined })),
      pharmacy: pharmacyName
        ? {
            name: pharmacyName,
            phone: String(form.get("pharmacy_phone") ?? "").trim() || undefined,
            address: String(form.get("pharmacy_address") ?? "").trim() || undefined,
          }
        : undefined,
      emergency_contacts: contacts
        .filter((row) => row.name.trim())
        .map((row) => ({ name: row.name.trim(), relationship: row.extra.trim() || undefined, phone: row.phone.trim() || undefined })),
      poa_location: poa || undefined,
    };
    setError(null);
    start(async () => {
      try {
        const key = await generateCircleKey();
        const words = (await generatePhrase()).split(" ");
        setCircleKey(key);
        setPhrase(words);
        setDraft({ content, consents: { authorized_to_share: true, terms: true, privacy: true } });
      } catch {
        setError("The key could not be created in this browser. Try again.");
      }
    });
  }

  function confirmPhrase() {
    if (!draft || !circleKey || !phrase) return;
    start(async () => {
      try {
        const circleKeyWrapped = await wrapCircleKey(circleKey, phrase.join(" "));
        const result = await createCircle({ ...draft, circleKeyWrapped });
        if (!result.ok) {
          setError(result.error);
          return;
        }
        try {
          await saveCircleKey(result.circleId, circleKey, 1);
        } catch {
          setSavedId(result.circleId);
          setError("The circle is saved, but this browser could not keep the key. Leave only after the words are written down. You can enter them again from your circles.");
          return;
        }
        router.push(`/circles/${result.circleId}`);
      } catch {
        setError("The key could not be saved. The words are still on this page. Try again.");
      }
    });
  }

  return (
    <>
      <Progress current={shown} />
      {phrase ? (
        <div className="mt-8" />
      ) : (
        <>
          <h2 ref={heading} tabIndex={-1} className="font-display mt-8 text-section text-ink-900 outline-none sm:text-page">
            {TITLES[shown]}
          </h2>
          <p className="mt-2 mb-8 text-ink-500">{HINTS[shown]}</p>
        </>
      )}
      {phrase ? (
        <div className="space-y-4">
          <RecoveryPhrase
            words={phrase}
            pending={pending}
            error={error}
            onConfirm={confirmPhrase}
            onBack={() => {
              setPhrase(null);
              setCircleKey(null);
              setDraft(null);
              setSavedId(null);
              setError(null);
            }}
          />
          {savedId ? (
            <a href={`/circles/${savedId}`} className="inline-flex min-h-12 items-center font-semibold text-primary-700">
              Open the circle
            </a>
          ) : null}
        </div>
      ) : null}
      <form onSubmit={onSubmit} hidden={phrase ? true : undefined} className="space-y-8">
      <div hidden={step !== 0 ? true : undefined}>
        <label htmlFor="person_name" className="font-medium text-ink-900">
          Their name
        </label>
        <input
          id="person_name"
          name="person_name"
          required
          autoComplete="off"
          aria-describedby="person_name-hint"
          className={field}
        />
        <p id="person_name-hint" className="mt-1 text-sm text-ink-500">
          Their name, not yours. For example, Margaret Lee or Mom. Helpers see it at the top of the page.
        </p>
      </div>

      <div hidden={step !== 1 ? true : undefined} className="space-y-8">
      <div>
        <label htmlFor="allergies" className="font-medium text-ink-900">
          Their allergies
        </label>
        <textarea id="allergies" name="allergies" rows={3} className={`${field} min-h-24 py-2`} />
        <p className="mt-1 text-sm text-ink-500">One per line. Leave blank if you have nothing to record.</p>
      </div>

      <fieldset className="space-y-3">
        <legend className="font-medium text-ink-900">Doctors</legend>
        {doctors.map((row, index) => (
          <div key={index} className="grid gap-2 rounded-2xl border border-border-200 bg-white p-3">
            <label className="text-sm text-ink-500" htmlFor={`doctor-name-${index}`}>
              Name
            </label>
            <input id={`doctor-name-${index}`} value={row.name} onChange={(event) => setDoctors(update(doctors, index, { name: event.target.value }))} className={field} />
            <label className="text-sm text-ink-500" htmlFor={`doctor-extra-${index}`}>
              Specialty
            </label>
            <input id={`doctor-extra-${index}`} value={row.extra} onChange={(event) => setDoctors(update(doctors, index, { extra: event.target.value }))} className={field} />
            <label className="text-sm text-ink-500" htmlFor={`doctor-phone-${index}`}>
              Phone
            </label>
            <input id={`doctor-phone-${index}`} inputMode="tel" autoComplete="tel" value={row.phone} onChange={(event) => setDoctors(update(doctors, index, { phone: event.target.value }))} className={field} />
            {doctors.length > 1 ? (
              <Button variant="ghost" className="justify-start px-0" onClick={() => setDoctors(doctors.filter((_, item) => item !== index))}>
                Remove doctor
              </Button>
            ) : null}
          </div>
        ))}
        <Button variant="secondary" onClick={() => setDoctors([...doctors, empty()])}>
          Add a doctor
        </Button>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="font-medium text-ink-900">Pharmacy</legend>
        <label className="text-sm text-ink-500" htmlFor="pharmacy_name">
          Name
        </label>
        <input id="pharmacy_name" name="pharmacy_name" className={field} />
        <label className="text-sm text-ink-500" htmlFor="pharmacy_phone">
          Phone
        </label>
        <input id="pharmacy_phone" name="pharmacy_phone" inputMode="tel" autoComplete="tel" className={field} />
        <label className="text-sm text-ink-500" htmlFor="pharmacy_address">
          Address
        </label>
        <input id="pharmacy_address" name="pharmacy_address" autoComplete="street-address" className={field} />
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="font-medium text-ink-900">Emergency contacts</legend>
        {contacts.map((row, index) => (
          <div key={index} className="grid gap-2 rounded-2xl border border-border-200 bg-white p-3">
            <label className="text-sm text-ink-500" htmlFor={`contact-name-${index}`}>
              Name
            </label>
            <input id={`contact-name-${index}`} value={row.name} onChange={(event) => setContacts(update(contacts, index, { name: event.target.value }))} className={field} />
            <label className="text-sm text-ink-500" htmlFor={`contact-extra-${index}`}>
              Relationship
            </label>
            <input id={`contact-extra-${index}`} value={row.extra} onChange={(event) => setContacts(update(contacts, index, { extra: event.target.value }))} className={field} />
            <label className="text-sm text-ink-500" htmlFor={`contact-phone-${index}`}>
              Phone
            </label>
            <input id={`contact-phone-${index}`} inputMode="tel" autoComplete="tel" value={row.phone} onChange={(event) => setContacts(update(contacts, index, { phone: event.target.value }))} className={field} />
            {contacts.length > 1 ? (
              <Button variant="ghost" className="justify-start px-0" onClick={() => setContacts(contacts.filter((_, item) => item !== index))}>
                Remove contact
              </Button>
            ) : null}
          </div>
        ))}
        <Button variant="secondary" onClick={() => setContacts([...contacts, empty()])}>
          Add a contact
        </Button>
      </fieldset>

      <div>
        <label htmlFor="poa_location" className="font-medium text-ink-900">
          Where the power of attorney is kept
        </label>
        <input id="poa_location" name="poa_location" className={field} />
      </div>
      </div>

      <fieldset hidden={step !== 2 ? true : undefined} className="space-y-3">
        <legend className="sr-only">Before you save</legend>
        {CONSENT_TYPES.map((type) => (
          <label key={type} className="flex items-start gap-3 text-ink-900">
            <input
              type="checkbox"
              className="mt-1 h-5 w-5 shrink-0 accent-primary-700"
              checked={consents[type]}
              onChange={(event) => setConsents({ ...consents, [type]: event.target.checked })}
            />
            <span>{CONSENT_TEXT[type]}</span>
          </label>
        ))}
      </fieldset>

      {error && !phrase ? (
        <p role="alert" className="rounded-xl bg-attn-bg px-3 py-2 text-attn-ink">
          {error}
        </p>
      ) : null}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        {step > 0 ? (
          <Button
            variant="ghost"
            onClick={() => {
              setError(null);
              setStep(step - 1);
            }}
          >
            Back
          </Button>
        ) : (
          <span />
        )}
        <Button type="submit" className="sm:min-w-48" disabled={pending}>
          {step < 2 ? "Continue" : pending ? "Saving" : "Create circle"}
        </Button>
      </div>
    </form>
    </>
  );
}

const TITLES = ["Who are you caring for?", "Their care summary", "Before you save"];
const HINTS = [
  "One circle is for one person. You add the people who help after this.",
  "What a helper needs in a hurry. Leave anything blank that you don't want to record.",
  "Confirm each statement to create the circle.",
];

function Progress({ current }: { current: number }) {
  return (
    <ol className="grid grid-cols-4 gap-2" aria-label={`Step ${current + 1} of ${STEPS.length}`}>
      {STEPS.map((label, index) => (
        <li key={label} aria-current={index === current ? "step" : undefined}>
          <span className={`block h-1 rounded-full ${index <= current ? "bg-primary-700" : "bg-border-200"}`} />
          <span className={`mt-2 hidden text-sm sm:block ${index === current ? "font-semibold text-ink-900" : "text-ink-500"}`}>{label}</span>
        </li>
      ))}
    </ol>
  );
}

function update(rows: Row[], index: number, patch: Partial<Row>): Row[] {
  return rows.map((row, item) => (item === index ? { ...row, ...patch } : row));
}
