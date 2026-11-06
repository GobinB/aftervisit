"use client";

import { Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { saveCareSummary } from "@/app/actions/circles";
import { Chips } from "@/components/ui/Chips";
import { careSummaryError, type SummaryRow } from "@/lib/circle-form";
import type { CircleContent } from "@/lib/schema/circles";

export const SUMMARY_PARTS = ["allergies", "doctors", "contacts", "pharmacy", "poa"] as const;
export type SummaryPart = (typeof SUMMARY_PARTS)[number];

export const PART_TITLES: Record<SummaryPart, string> = {
  allergies: "Allergies",
  doctors: "Doctors",
  contacts: "Who to call in an emergency",
  pharmacy: "Pharmacy",
  poa: "Power of attorney",
};

/** Common allergies, one tap each. Anything else can be typed. */
const COMMON_ALLERGIES = ["Penicillin", "Sulfa drugs", "Aspirin", "Ibuprofen", "Codeine", "Latex", "Iodine contrast", "Peanuts", "Shellfish", "Eggs", "Bee stings"];
const RELATIONSHIPS = ["Daughter", "Son", "Spouse", "Sister", "Brother", "Neighbor", "Friend"];
const SPECIALTIES = ["Primary care", "Cardiology", "Neurology", "Orthopedics", "Eye doctor", "Dentist"];

const field = "mt-1 block min-h-12 w-full rounded-lg border border-border-200 bg-white px-3 text-[16px] text-ink-900 outline-none focus:border-action-500";
const label = "block text-[14px] font-medium text-ink-900";

const blank = (): SummaryRow => ({ name: "", extra: "", phone: "" });

/**
 * The care summary, one part at a time, so it can be filled in whenever the caregiver has a minute.
 * Saving keeps every other part as it was.
 */
export function SummaryEditor({ circleId, content, part }: { circleId: string; content: CircleContent; part: SummaryPart | null }) {
  const id = useId();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [allergies, setAllergies] = useState<string[]>(content.allergies);
  const [typed, setTyped] = useState("");
  const [doctors, setDoctors] = useState<SummaryRow[]>(
    content.doctors.length ? content.doctors.map((d) => ({ name: d.name, extra: d.specialty ?? "", phone: d.phone ?? "" })) : [blank()],
  );
  const [contacts, setContacts] = useState<SummaryRow[]>(
    content.emergency_contacts.length ? content.emergency_contacts.map((c) => ({ name: c.name, extra: c.relationship ?? "", phone: c.phone ?? "" })) : [blank()],
  );
  const [pharmacy, setPharmacy] = useState({ name: content.pharmacy?.name ?? "", phone: content.pharmacy?.phone ?? "", address: content.pharmacy?.address ?? "" });
  const [poa, setPoa] = useState(content.poa_location ?? "");
  const shows = (which: SummaryPart) => part === null || part === which;

  const addAllergy = (value: string) => {
    const clean = value.trim();
    if (!clean || allergies.some((item) => item.toLowerCase() === clean.toLowerCase())) return;
    setAllergies([...allergies, clean]);
  };

  const save = (event: React.FormEvent) => {
    event.preventDefault();
    const all = typed.trim() ? [...allergies, typed.trim()] : allergies;
    const problem = careSummaryError({
      allergies: all.join("\n"),
      doctors,
      pharmacyName: pharmacy.name,
      pharmacyPhone: pharmacy.phone,
      pharmacyAddress: pharmacy.address,
      contacts,
      poa,
    });
    if (problem) {
      setError(problem);
      return;
    }
    const next: CircleContent = {
      person_name: content.person_name,
      allergies: all,
      doctors: doctors.filter((row) => row.name.trim()).map((row) => ({ name: row.name.trim(), specialty: row.extra.trim() || undefined, phone: row.phone.trim() || undefined })),
      pharmacy: pharmacy.name.trim()
        ? { name: pharmacy.name.trim(), phone: pharmacy.phone.trim() || undefined, address: pharmacy.address.trim() || undefined }
        : undefined,
      emergency_contacts: contacts
        .filter((row) => row.name.trim())
        .map((row) => ({ name: row.name.trim(), relationship: row.extra.trim() || undefined, phone: row.phone.trim() || undefined })),
      poa_location: poa.trim() || undefined,
    };
    setError(null);
    start(async () => {
      const result = await saveCareSummary({ circleId, content: next });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(part ? `/circles/${circleId}` : `/circles/${circleId}/summary`);
      router.refresh();
    });
  };

  const rows = (
    kind: "doctor" | "contact",
    list: SummaryRow[],
    set: (rows: SummaryRow[]) => void,
    extraLabel: string,
    suggestions: string[],
  ) => (
    <div className="space-y-3">
      {list.map((row, index) => (
        <div key={index} className="space-y-3 rounded-lg border border-border-200 bg-white p-3">
          <div>
            <label className={label} htmlFor={`${id}-${kind}-name-${index}`}>
              Name
            </label>
            <input
              id={`${id}-${kind}-name-${index}`}
              className={field}
              value={row.name}
              placeholder={kind === "doctor" ? "e.g. Dr. Patel" : "e.g. Anna"}
              onChange={(event) => set(list.map((r, i) => (i === index ? { ...r, name: event.target.value } : r)))}
            />
          </div>
          <div>
            <span className={label} id={`${id}-${kind}-extra-label-${index}`}>
              {extraLabel}
            </span>
            <Chips
              label={extraLabel}
              options={suggestions}
              value={row.extra}
              onPick={(value) => set(list.map((r, i) => (i === index ? { ...r, extra: value } : r)))}
            />
            <input
              aria-labelledby={`${id}-${kind}-extra-label-${index}`}
              className={field}
              value={row.extra}
              placeholder="Or type it"
              onChange={(event) => set(list.map((r, i) => (i === index ? { ...r, extra: event.target.value } : r)))}
            />
          </div>
          <div>
            <label className={label} htmlFor={`${id}-${kind}-phone-${index}`}>
              Phone
            </label>
            <input
              id={`${id}-${kind}-phone-${index}`}
              className={field}
              inputMode="tel"
              autoComplete="tel"
              value={row.phone}
              placeholder="e.g. 555-0142"
              onChange={(event) => set(list.map((r, i) => (i === index ? { ...r, phone: event.target.value } : r)))}
            />
          </div>
          {list.length > 1 ? (
            <button type="button" className="text-[14px] font-medium text-attn-ink hover:underline" onClick={() => set(list.filter((_, i) => i !== index))}>
              Remove
            </button>
          ) : null}
        </div>
      ))}
      <button
        type="button"
        onClick={() => set([...list, blank()])}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-border-200 bg-white px-3 text-[14px] font-semibold text-primary-700 hover:bg-sky-100"
      >
        <Plus className="size-4" aria-hidden="true" /> Add another
      </button>
    </div>
  );

  return (
    <form onSubmit={save} className="max-w-xl space-y-7" noValidate>
      {shows("allergies") ? (
        <fieldset>
          <legend className="font-display text-[20px] text-primary-900">{PART_TITLES.allergies}</legend>
          <p className="mt-1 text-[14px] text-ink-500">Tap any that apply, or type one.</p>
          {allergies.length ? (
            <ul className="mt-3 flex flex-wrap gap-2">
              {allergies.map((item) => (
                <li key={item}>
                  <button
                    type="button"
                    onClick={() => setAllergies(allergies.filter((a) => a !== item))}
                    className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-attn-bg px-3 text-[15px] font-semibold text-attn-ink"
                    aria-label={`Remove ${item}`}
                  >
                    {item} <X className="size-4" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <Chips label="Common allergies" options={COMMON_ALLERGIES.filter((a) => !allergies.includes(a))} onPick={addAllergy} />
          <div className="mt-2 flex gap-2">
            <label htmlFor={`${id}-allergy`} className="sr-only">
              Another allergy
            </label>
            <input
              id={`${id}-allergy`}
              className={`${field} mt-0 flex-1`}
              value={typed}
              placeholder="e.g. Morphine"
              onChange={(event) => setTyped(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addAllergy(typed);
                  setTyped("");
                }
              }}
            />
            <button
              type="button"
              onClick={() => {
                addAllergy(typed);
                setTyped("");
              }}
              className="inline-flex min-h-12 items-center rounded-lg border border-border-200 bg-white px-4 text-[15px] font-semibold text-primary-700 hover:bg-sky-100"
            >
              Add
            </button>
          </div>
        </fieldset>
      ) : null}

      {shows("doctors") ? (
        <fieldset>
          <legend className="font-display mb-3 text-[20px] text-primary-900">{PART_TITLES.doctors}</legend>
          {rows("doctor", doctors, setDoctors, "What kind of doctor", SPECIALTIES)}
        </fieldset>
      ) : null}

      {shows("contacts") ? (
        <fieldset>
          <legend className="font-display mb-3 text-[20px] text-primary-900">{PART_TITLES.contacts}</legend>
          {rows("contact", contacts, setContacts, "Who they are", RELATIONSHIPS)}
        </fieldset>
      ) : null}

      {shows("pharmacy") ? (
        <fieldset className="space-y-3">
          <legend className="font-display mb-3 text-[20px] text-primary-900">{PART_TITLES.pharmacy}</legend>
          <div>
            <label className={label} htmlFor={`${id}-ph-name`}>
              Name
            </label>
            <input id={`${id}-ph-name`} className={field} value={pharmacy.name} placeholder="e.g. Main Street Pharmacy" onChange={(e) => setPharmacy({ ...pharmacy, name: e.target.value })} />
          </div>
          <div>
            <label className={label} htmlFor={`${id}-ph-phone`}>
              Phone
            </label>
            <input id={`${id}-ph-phone`} className={field} inputMode="tel" value={pharmacy.phone} onChange={(e) => setPharmacy({ ...pharmacy, phone: e.target.value })} />
          </div>
          <div>
            <label className={label} htmlFor={`${id}-ph-address`}>
              Address
            </label>
            <input id={`${id}-ph-address`} className={field} autoComplete="street-address" value={pharmacy.address} onChange={(e) => setPharmacy({ ...pharmacy, address: e.target.value })} />
          </div>
        </fieldset>
      ) : null}

      {shows("poa") ? (
        <fieldset>
          <legend className="font-display mb-1 text-[20px] text-primary-900">{PART_TITLES.poa}</legend>
          <label className={label} htmlFor={`${id}-poa`}>
            Where the papers are kept
          </label>
          <input id={`${id}-poa`} className={field} value={poa} placeholder="e.g. Blue folder in the hall desk" onChange={(e) => setPoa(e.target.value)} />
        </fieldset>
      ) : null}

      {error ? (
        <p role="alert" className="rounded-lg bg-attn-bg px-3 py-2 text-[14px] text-attn-ink">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-12 w-full items-center justify-center rounded-lg bg-primary-700 px-5 text-[16px] font-semibold text-white hover:bg-primary-900 disabled:opacity-50 sm:w-auto"
      >
        {pending ? "Saving" : "Save"}
      </button>
    </form>
  );
}
