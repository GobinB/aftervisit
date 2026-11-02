"use client";

import { useState, useTransition } from "react";
import { createCircle } from "@/app/actions/circles";
import { Button } from "@/components/ui/Button";
import { CONSENT_TEXT, CONSENT_TYPES, type ConsentType } from "@/lib/schema/circles";

const field =
  "mt-1.5 w-full min-h-12 rounded-xl border border-border-200 bg-white px-3 text-base text-ink-900 outline-none focus:border-action-500";

type Row = { name: string; extra: string; phone: string };

const empty = (): Row => ({ name: "", extra: "", phone: "" });

function lines(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export function CircleForm() {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [doctors, setDoctors] = useState<Row[]>([empty()]);
  const [contacts, setContacts] = useState<Row[]>([empty()]);
  const [consents, setConsents] = useState<Record<ConsentType, boolean>>({
    authorized_to_share: false,
    terms: false,
    privacy: false,
  });

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (CONSENT_TYPES.some((type) => !consents[type])) {
      setError("Confirm each statement to continue.");
      return;
    }
    const pharmacyName = String(form.get("pharmacy_name") ?? "").trim();
    const poa = String(form.get("poa_location") ?? "").trim();
    start(async () => {
      const result = await createCircle({
        content: {
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
        },
        consents: { authorized_to_share: true, terms: true, privacy: true },
      });
      if (result && !result.ok) setError(result.error);
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-8">
      <div>
        <label htmlFor="person_name" className="font-medium text-ink-900">
          Name
        </label>
        <input id="person_name" name="person_name" required autoComplete="name" className={field} />
        <p className="mt-1 text-sm text-ink-500">Saved exactly as you type it.</p>
      </div>

      <div>
        <label htmlFor="allergies" className="font-medium text-ink-900">
          Allergies
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

      <fieldset className="space-y-3">
        <legend className="font-medium text-ink-900">Before you save</legend>
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

      {error ? (
        <p role="alert" className="rounded-xl bg-attn-bg px-3 py-2 text-attn-ink">
          {error}
        </p>
      ) : null}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Saving" : "Create circle"}
      </Button>
    </form>
  );
}

function update(rows: Row[], index: number, patch: Partial<Row>): Row[] {
  return rows.map((row, item) => (item === index ? { ...row, ...patch } : row));
}
