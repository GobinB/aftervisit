"use client";

import { Plus } from "lucide-react";
import { useId, useState } from "react";
import { cleanPhone } from "@/lib/phone";
import { HELPER_ROLES, HELPER_ROLE_LABELS, type HelperRole } from "@/lib/schema/circles";

/**
 * Someone who can be put down for an appointment or a reminder: a person already in the circle (a
 * member id), or one added on this page, who has an id starting "new:" until the circle is updated.
 */
export type Helper = { value: string; label: string; name: string; phone: string | null; role?: HelperRole; isNew?: boolean };

export const isNewHelper = (value: string) => value.startsWith("new:");

const chip = "inline-flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-label font-semibold";

/**
 * Who is going, or whose reminder it is: Me, each person in the circle, or someone new. Nobody is
 * picked to start with; tapping the picked one again clears it.
 */
export function HelperChips({
  value,
  onPick,
  people,
  adding,
  onAdd,
  label,
}: {
  value: string;
  onPick: (value: string) => void;
  people: Helper[];
  adding: boolean;
  onAdd: () => void;
  label: string;
}) {
  const options = [{ value: "caregiver", label: "Me" }, ...people];
  return (
    <ul aria-label={label} className="mt-2 flex flex-wrap gap-2">
      {options.map((person) => {
        const on = value === person.value;
        return (
          <li key={person.value}>
            <button
              type="button"
              aria-pressed={on}
              onClick={() => onPick(on ? "none" : person.value)}
              className={`${chip} ${on ? "border-primary-700 bg-primary-700 text-white" : "border-border-200 bg-white text-primary-900 hover:bg-sky-100"}`}
            >
              {person.label}
            </button>
          </li>
        );
      })}
      <li>
        <button
          type="button"
          aria-expanded={adding}
          onClick={onAdd}
          className={`${chip} border-dashed border-primary-700/60 bg-white text-primary-700 hover:bg-sky-100`}
        >
          <Plus className="size-4" aria-hidden="true" /> Add someone
        </button>
      </li>
    </ul>
  );
}

const field = "mt-1 w-full min-h-12 rounded-lg border border-border-200 bg-white px-3 text-base text-ink-900 outline-none focus:border-action-500";

/**
 * A short form for someone who is not in the circle yet: a name, who they are, and a number to text
 * their link to. Nothing is saved here; they join the circle when it is updated.
 */
export function AddSomeone({ onAdd, onCancel }: { onAdd: (person: { name: string; role: HelperRole; phone: string | null }) => void; onCancel: () => void }) {
  const ids = { name: useId(), phone: useId() };
  const [name, setName] = useState("");
  const [role, setRole] = useState<HelperRole>("family");
  const [phone, setPhone] = useState("");
  const [problem, setProblem] = useState<string | null>(null);

  function add(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) {
      setProblem("Type their name.");
      return;
    }
    const checked = cleanPhone(phone);
    if (!checked.ok) {
      setProblem(checked.error);
      return;
    }
    onAdd({ name: name.trim().slice(0, 80), role, phone: checked.phone });
  }

  return (
    <form onSubmit={add} aria-label="Add someone" noValidate className="mt-3 space-y-3 rounded-lg border border-border-200 bg-surface-50 p-3">
      <div>
        <label htmlFor={ids.name} className="text-label font-semibold text-ink-900">
          Name
        </label>
        <input id={ids.name} className={field} value={name} maxLength={80} autoComplete="off" autoFocus placeholder="e.g. Anna" onChange={(event) => setName(event.target.value)} />
      </div>
      <fieldset>
        <legend className="text-label font-semibold text-ink-900">Who they are</legend>
        <div className="mt-1 flex flex-wrap gap-2">
          {HELPER_ROLES.map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={role === item}
              onClick={() => setRole(item)}
              className={`${chip} ${role === item ? "border-primary-700 bg-primary-700 text-white" : "border-border-200 bg-white text-primary-900 hover:bg-sky-100"}`}
            >
              {HELPER_ROLE_LABELS[item]}
            </button>
          ))}
        </div>
      </fieldset>
      <div>
        <label htmlFor={ids.phone} className="text-label font-semibold text-ink-900">
          Phone <span className="font-normal text-ink-500">(to text them their link)</span>
        </label>
        <input id={ids.phone} className={field} value={phone} maxLength={40} inputMode="tel" autoComplete="off" placeholder="e.g. 555-010-0142" onChange={(event) => setPhone(event.target.value)} />
      </div>
      {problem ? (
        <p role="alert" className="rounded-lg bg-attn-bg px-3 py-2 text-note text-attn-ink">
          {problem}
        </p>
      ) : null}
      <p className="text-hint text-ink-500">They get their own link when you update the circle, and you can text it to them right after. They see the calendar and reminders; change that any time on People.</p>
      <div className="flex flex-wrap gap-2">
        <button type="submit" className="inline-flex min-h-12 items-center rounded-lg bg-primary-700 px-5 text-label font-semibold text-white hover:bg-primary-900">
          Add {name.trim() ? name.trim().split(/\s+/)[0] : "them"}
        </button>
        <button type="button" onClick={onCancel} className="inline-flex min-h-12 items-center rounded-lg px-4 text-label font-semibold text-ink-500 hover:bg-paper-100">
          Cancel
        </button>
      </div>
    </form>
  );
}
