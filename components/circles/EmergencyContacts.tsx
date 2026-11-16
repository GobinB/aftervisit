"use client";

import { Plus, UserPlus, X } from "lucide-react";
import { useId, useState } from "react";
import { addEmergencyContactAction, removeEmergencyContactAction } from "@/app/actions/circles";
import { CallButton } from "@/components/circles/CallButton";

type Contact = { name: string; relationship?: string; phone?: string };
/** Someone in the circle who has a phone number, who could be made an emergency contact in one tap. */
type Candidate = { name: string; phone: string; roleLabel: string };

const field = "mt-1 w-full min-h-12 rounded-lg border border-border-200 bg-white px-3 text-base text-ink-900 outline-none focus:border-action-500";
const button = "inline-flex min-h-12 items-center gap-2 rounded-lg border border-border-200 bg-white px-4 text-[15px] font-semibold text-primary-700 hover:bg-sky-100 disabled:opacity-50";

/**
 * The Emergency page's contacts. Everyone sees the list with a call button for each; the caregiver can
 * also add one right here (a name, who they are, a number), add someone from the circle in one tap, or
 * remove one. Nothing goes through the care summary editor.
 */
export function EmergencyContacts({ circleId, contacts, candidates, canEdit }: { circleId: string; contacts: Contact[]; candidates: Candidate[]; canEdit: boolean }) {
  const ids = { name: useId(), who: useId(), phone: useId() };
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [who, setWho] = useState("");
  const [phone, setPhone] = useState("");
  const [pending, setPending] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  async function run(work: () => Promise<{ ok: true } | { ok: false; error: string }>, done: string) {
    setPending(true);
    setProblem(null);
    setNote(null);
    try {
      const result = await work();
      if (!result.ok) {
        setProblem(result.error);
        return false;
      }
      setNote(done);
      return true;
    } catch {
      setProblem("That did not save. Check your connection and try again.");
      return false;
    } finally {
      setPending(false);
    }
  }

  async function add(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) {
      setProblem("Type their name.");
      return;
    }
    const saved = await run(() => addEmergencyContactAction({ circleId, name: name.trim(), relationship: who.trim() || undefined, phone: phone.trim() || undefined }), `${name.trim()} was added.`);
    if (saved) {
      setName("");
      setWho("");
      setPhone("");
      setAdding(false);
    }
  }

  const listed = new Set(contacts.map((contact) => (contact.phone ?? "").replace(/\D/g, "")).filter(Boolean));
  const suggestions = candidates.filter((person) => !listed.has(person.phone.replace(/\D/g, "")));

  return (
    <div>
      {contacts.length ? (
        <ul className="divide-y divide-border-200">
          {contacts.map((contact, index) => (
            <li key={`${contact.name}-${index}`} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3">
              <div className="min-w-0">
                <p className="text-[17px] font-semibold text-ink-900">{contact.name}</p>
                {contact.relationship ? <p className="text-[14px] text-ink-500">{contact.relationship}</p> : null}
              </div>
              <div className="flex items-center gap-2">
                {contact.phone ? <CallButton phone={contact.phone} name={contact.name} /> : <span className="text-[14px] text-ink-500">No number written down</span>}
                {canEdit ? (
                  <button
                    type="button"
                    disabled={pending}
                    aria-label={`Remove ${contact.name} from emergency contacts`}
                    onClick={() => run(() => removeEmergencyContactAction({ circleId, index, name: contact.name }), `${contact.name} was removed.`)}
                    className="no-print inline-flex size-12 items-center justify-center rounded-lg text-ink-500 hover:bg-attn-bg hover:text-attn-ink disabled:opacity-50"
                  >
                    <X className="size-5" aria-hidden="true" />
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="py-2 text-ink-500">No emergency contact yet.</p>
      )}

      {canEdit ? (
        <div className="no-print">
          {problem ? (
            <p role="alert" className="mt-2 rounded-lg bg-attn-bg px-3 py-2 text-[14px] text-attn-ink">
              {problem}
            </p>
          ) : null}
          {note ? (
            <p role="status" className="mt-2 text-[14px] text-ok-ink">
              {note}
            </p>
          ) : null}

          {adding ? (
            <form onSubmit={add} aria-label="Add an emergency contact" className="mt-3 space-y-3 rounded-lg border border-border-200 bg-surface-50 p-3">
              <div>
                <label htmlFor={ids.name} className="text-[15px] font-semibold text-ink-900">
                  Name
                </label>
                <input id={ids.name} className={field} value={name} maxLength={80} autoComplete="off" placeholder="e.g. Anna" onChange={(event) => setName(event.target.value)} />
              </div>
              <div>
                <label htmlFor={ids.who} className="text-[15px] font-semibold text-ink-900">
                  Who they are <span className="font-normal text-ink-500">(optional)</span>
                </label>
                <input id={ids.who} className={field} value={who} maxLength={80} autoComplete="off" placeholder="e.g. Daughter, neighbor" onChange={(event) => setWho(event.target.value)} />
              </div>
              <div>
                <label htmlFor={ids.phone} className="text-[15px] font-semibold text-ink-900">
                  Phone
                </label>
                <input id={ids.phone} className={field} value={phone} maxLength={40} inputMode="tel" autoComplete="off" placeholder="e.g. 555-010-0142" onChange={(event) => setPhone(event.target.value)} />
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="submit" disabled={pending} className="inline-flex min-h-12 items-center rounded-lg bg-primary-700 px-5 text-[15px] font-semibold text-white hover:bg-primary-900 disabled:opacity-50">
                  {pending ? "Saving" : "Save contact"}
                </button>
                <button type="button" disabled={pending} onClick={() => setAdding(false)} className="inline-flex min-h-12 items-center rounded-lg px-4 text-[15px] font-semibold text-ink-500 hover:bg-paper-100">
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <button type="button" onClick={() => setAdding(true)} className={`mt-3 ${button}`}>
              <Plus className="size-4" aria-hidden="true" /> Add an emergency contact
            </button>
          )}

          {suggestions.length ? (
            <div className="mt-4">
              <p className="text-[14px] text-ink-500">Or add someone from the circle:</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {suggestions.map((person) => (
                  <button
                    key={`${person.name}-${person.phone}`}
                    type="button"
                    disabled={pending}
                    onClick={() => run(() => addEmergencyContactAction({ circleId, name: person.name, relationship: person.roleLabel, phone: person.phone }), `${person.name} was added.`)}
                    className={button}
                  >
                    <UserPlus className="size-4" aria-hidden="true" /> {person.name}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
