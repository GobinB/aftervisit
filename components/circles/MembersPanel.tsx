"use client";

import { ChevronDown, Link2, Share2, Trash2, UserPlus } from "lucide-react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addMemberAction, changeRoleAction, newLinkAction, renewMemberAction, revokeMemberAction, setVisibilityAction } from "@/app/actions/members";
import { urlForMemberToken } from "@/components/circles/member-link";
import { PeopleList } from "@/components/circles/PeopleList";
import { ShareLink, type ShareableLink } from "@/components/circles/ShareLink";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Switch } from "@/components/ui/Switch";
import { dateTime } from "@/lib/format";
import { forgetLink, loadLink, saveLink } from "@/lib/local-links";
import { AREA_DETAILS, ROLE_DETAILS, SEE_PRESETS, presetFor } from "@/lib/share-message";
import { AREA_LABELS, HELPER_ROLES, HELPER_ROLE_LABELS, READY_AREAS, type HelperRole, type PersonView, type VisibilityArea } from "@/lib/schema/circles";

const field = "mt-1.5 w-full min-h-12 rounded-xl border border-border-200 bg-white px-3 text-[16px] text-ink-900 outline-none focus:border-action-500";
const option = "flex min-h-12 cursor-pointer items-start gap-3 rounded-xl border border-border-200 bg-white px-3 py-2.5 has-[:checked]:border-primary-700 has-[:checked]:bg-sky-100/60";
const action = "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-4 text-[15px] font-semibold disabled:opacity-50";

type Saved = { ok: boolean; error?: string; token?: string; memberId?: string; name?: string; email?: string | null };

export function MembersPanel({
  circleId,
  personName,
  people,
  canManage,
  keyVersion,
}: {
  circleId: string;
  personName: string;
  people: PersonView[];
  canManage: boolean;
  keyVersion: number | null;
}) {
  const router = useRouter();
  const helpers = people.filter((person) => person.kind === "member");
  const [share, setShare] = useState<{ link: ShareableLink; fresh: boolean } | null>(null);
  const [adding, setAdding] = useState(helpers.length === 0);
  const [open, setOpen] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  /** After a new link (a new person, or a replaced link): remember it on this device and offer the three ways to send it. */
  async function linkReady(result: Saved, pin: string | null, fresh: boolean) {
    if (!result.ok) {
      setError(result.error ?? "That could not be saved. Try again.");
      return;
    }
    setError(null);
    if (result.token && result.name && result.memberId) {
      const built = await urlForMemberToken(circleId, result.token, keyVersion);
      if (!built.ok) {
        setError(built.error);
      } else {
        saveLink(circleId, result.memberId, built.url, pin);
        const saved = loadLink(circleId, result.memberId);
        setShare({ link: { url: built.url, name: result.name, email: result.email ?? null, pin: saved?.pin ?? pin, personName }, fresh });
        setAdding(false);
      }
    }
    router.refresh();
  }

  /** Tapping a name opens their profile and copies their link, when this device has it. */
  async function tap(person: PersonView) {
    if (open === person.id) {
      setOpen(null);
      return;
    }
    setOpen(person.id);
    setNote(null);
    const saved = person.revokedAt ? null : loadLink(circleId, person.id);
    if (!saved) return;
    try {
      await navigator.clipboard.writeText(saved.url);
      setNote(`${person.name}'s link is copied. Paste it into a message, or tap Share.`);
    } catch {
      setNote(null);
    }
  }

  if (!canManage) return <PeopleList people={people} showSeen={false} />;

  return (
    <div className="space-y-5">
      {share ? <ShareLink link={share.link} fresh={share.fresh} onDone={() => setShare(null)} /> : null}
      {error ? (
        <p role="alert" className="rounded-xl bg-attn-bg px-3 py-2 text-attn-ink">
          {error}
        </p>
      ) : null}

      {adding ? (
        <div className="max-w-xl">
          <AddPerson circleId={circleId} onCancel={helpers.length ? () => setAdding(false) : undefined} onDone={(result, pin) => linkReady(result, pin, true)} />
        </div>
      ) : (
        <button type="button" onClick={() => setAdding(true)} className={`${action} bg-primary-700 text-white hover:bg-primary-900`}>
          <UserPlus className="size-5" aria-hidden="true" /> Add a person
        </button>
      )}

      <p aria-live="polite" className={note ? "rounded-lg bg-ok-bg px-3 py-2 text-[14px] font-medium text-ok-ink" : "sr-only"}>
        {note ?? ""}
      </p>

      <ul className="divide-y divide-border-200 overflow-hidden rounded-2xl border border-border-200 bg-white">
        {people.map((person) => {
          const member = person.kind === "member";
          const expanded = open === person.id;
          return (
            <li key={`${person.kind}-${person.id}`}>
              {member ? (
                <button
                  type="button"
                  onClick={() => tap(person)}
                  aria-expanded={expanded}
                  className="flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left hover:bg-sky-100/40"
                >
                  <PersonLine person={person} />
                  <ChevronDown className={`size-5 shrink-0 text-ink-500 transition-transform ${expanded ? "rotate-180" : ""}`} aria-hidden="true" />
                </button>
              ) : (
                <div className="flex min-h-16 items-center gap-3 px-4 py-3">
                  <PersonLine person={person} />
                </div>
              )}
              {member && expanded ? (
                <Profile
                  circleId={circleId}
                  person={person}
                  onShare={(saved) =>
                    setShare({ link: { url: saved.url, name: person.name, email: person.email ?? null, pin: saved.pin ?? null, personName }, fresh: false })
                  }
                  onNewLink={(result) => linkReady(result, null, false)}
                  onChanged={(result) => {
                    if (!result.ok) setError(result.error ?? "That could not be saved. Try again.");
                    else {
                      setError(null);
                      router.refresh();
                    }
                  }}
                />
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function PersonLine({ person }: { person: PersonView }) {
  return (
    <>
      <Avatar name={person.name} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[16px] font-semibold text-ink-900">{person.name}</span>
        <span className="block text-[13px] text-ink-500">
          {person.roleLabel}
          {person.kind === "member" && !person.revokedAt ? ` · ${person.lastSeenAt ? `opened ${dateTime(person.lastSeenAt)}` : "not opened yet"}` : ""}
        </span>
      </span>
      {person.revokedAt ? <Badge tone="attn">Removed</Badge> : person.locked ? <Badge tone="attn">Locked</Badge> : null}
    </>
  );
}

/** "What can Sam see?" A preset for most people, switches for anyone who wants to choose. */
function WhatCanSee({ name, hidden, setHidden }: { name: string; hidden: VisibilityArea[]; setHidden: (next: VisibilityArea[]) => void }) {
  const preset = presetFor(hidden);
  const [custom, setCustom] = useState(preset === "custom");
  const first = name.trim().split(/\s+/)[0] || "they";
  return (
    <fieldset>
      <legend className="text-[16px] font-semibold text-ink-900">What can {first} see?</legend>
      <div className="mt-2 grid gap-2">
        {SEE_PRESETS.map((item) => (
          <label key={item.key} className={option}>
            <input
              type="radio"
              name={`see-${name}`}
              className="mt-1 size-5 shrink-0 accent-primary-700"
              checked={!custom && preset === item.key}
              onChange={() => {
                setCustom(false);
                setHidden([...item.hidden]);
              }}
            />
            <span>
              <span className="block font-semibold text-ink-900">{item.label}</span>
              <span className="block text-[13px] text-ink-500">{item.detail}</span>
            </span>
          </label>
        ))}
        <label className={option}>
          <input type="radio" name={`see-${name}`} className="mt-1 size-5 shrink-0 accent-primary-700" checked={custom} onChange={() => setCustom(true)} />
          <span className="block font-semibold text-ink-900">Let me choose</span>
        </label>
      </div>
      {custom ? (
        <div className="mt-3 space-y-4 rounded-xl border border-border-200 bg-surface-50 p-3">
          {READY_AREAS.map((area) => (
            <Switch
              key={area}
              id={`see-${name}-${area}`}
              label={AREA_LABELS[area]}
              helper={AREA_DETAILS[area]}
              checked={!hidden.includes(area)}
              onChange={(on) => setHidden(on ? hidden.filter((item) => item !== area) : [...hidden, area])}
            />
          ))}
        </div>
      ) : null}
    </fieldset>
  );
}

function AddPerson({ circleId, onDone, onCancel }: { circleId: string; onDone: (result: Saved, pin: string | null) => Promise<void>; onCancel?: () => void }) {
  const [name, setName] = useState("");
  const [role, setRole] = useState<HelperRole>("family");
  const [hidden, setHidden] = useState<VisibilityArea[]>([]);
  const [email, setEmail] = useState("");
  const [pin, setPin] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const first = name.trim().split(/\s+/)[0];

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) {
      setProblem("Enter their name.");
      return;
    }
    if (pin && !/^\d{4}$/.test(pin)) {
      setProblem("A PIN is 4 numbers, or leave it blank.");
      return;
    }
    setProblem(null);
    start(async () => {
      const result = await addMemberAction({
        circleId,
        name: name.trim(),
        role,
        email: email.trim() || undefined,
        pin: pin || undefined,
        visibility: hidden.length ? { hidden } : {},
      });
      if (result.ok) {
        setName("");
        setRole("family");
        setHidden([]);
        setEmail("");
        setPin("");
      }
      await onDone(result, pin || null);
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6 rounded-2xl border border-border-200 bg-white p-4 sm:p-5" noValidate>
      <h2 className="font-display text-[22px] text-primary-900">Add a person</h2>
      <div>
        <label htmlFor="member-name" className="text-[16px] font-semibold text-ink-900">
          Their name
        </label>
        <input id="member-name" name="name" required className={field} value={name} placeholder="e.g. Sam" autoComplete="off" onChange={(e) => setName(e.target.value)} />
      </div>
      <fieldset>
        <legend className="text-[16px] font-semibold text-ink-900">Who is {first || "this"}?</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {HELPER_ROLES.map((item) => (
            <label key={item} className={option}>
              <input type="radio" name="role" value={item} className="mt-1 size-5 shrink-0 accent-primary-700" checked={role === item} onChange={() => setRole(item)} />
              <span>
                <span className="block font-semibold text-ink-900">{HELPER_ROLE_LABELS[item]}</span>
                <span className="block text-[13px] text-ink-500">{ROLE_DETAILS[item]}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <WhatCanSee name={name || "they"} hidden={hidden} setHidden={setHidden} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="member-email" className="text-[15px] font-semibold text-ink-900">
            Email <span className="font-normal text-ink-500">(optional)</span>
          </label>
          <input id="member-email" name="email" type="email" autoComplete="off" className={field} value={email} placeholder="e.g. sam@example.com" onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label htmlFor="member-pin" className="text-[15px] font-semibold text-ink-900">
            4-digit PIN <span className="font-normal text-ink-500">(optional)</span>
          </label>
          <input
            id="member-pin"
            name="pin"
            inputMode="numeric"
            autoComplete="off"
            maxLength={4}
            className={`${field} tracking-[0.3em]`}
            value={pin}
            placeholder="1234"
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
          />
          <p className="mt-1 text-[13px] text-ink-500">They type it when they open the link. It goes in the message with the link.</p>
        </div>
      </div>
      {problem ? (
        <p role="alert" className="rounded-xl bg-attn-bg px-3 py-2 text-attn-ink">
          {problem}
        </p>
      ) : null}
      <div className="flex flex-col gap-2 sm:flex-row">
        <button type="submit" disabled={pending} className={`${action} bg-primary-700 text-white hover:bg-primary-900 sm:min-w-56`}>
          {pending ? "Adding" : first ? `Add ${first}` : "Add"}
        </button>
        {onCancel ? (
          <button type="button" onClick={onCancel} className={`${action} text-ink-500 hover:bg-paper-100`}>
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  );
}

/** A person's small profile: share, new link, remove. What they see, their role and renewing sit under More. */
function Profile({
  circleId,
  person,
  onShare,
  onNewLink,
  onChanged,
}: {
  circleId: string;
  person: PersonView;
  onShare: (saved: { url: string; pin?: string }) => void;
  onNewLink: (result: Saved) => Promise<void>;
  onChanged: (result: Saved) => void;
}) {
  const [role, setRole] = useState<HelperRole>((HELPER_ROLES as readonly string[]).includes(person.role) ? (person.role as HelperRole) : "family");
  const [hidden, setHidden] = useState<VisibilityArea[]>((person.hidden ?? []) as VisibilityArea[]);
  const [confirm, setConfirm] = useState<"link" | "remove" | null>(null);
  const [pending, start] = useTransition();
  const saved = loadLink(circleId, person.id);
  const first = person.name.trim().split(/\s+/)[0] || person.name;
  const removed = Boolean(person.revokedAt);

  const run = (work: () => Promise<Saved>, after?: (result: Saved) => Promise<void> | void) =>
    start(async () => {
      const result = await work();
      setConfirm(null);
      await (after ?? onChanged)(result);
    });

  return (
    <div className="space-y-4 border-t border-border-200 bg-surface-50 px-4 py-4">
      {removed ? (
        <p className="text-[14px] text-ink-500">{first}&apos;s link was turned off. Make a new link to let them back in.</p>
      ) : !saved ? (
        <p className="text-[14px] text-ink-500">This device does not have {first}&apos;s link. Make a new link to share it; the old one then stops working.</p>
      ) : null}

      <div className="grid gap-2 sm:grid-cols-3">
        {saved && !removed ? (
          <button type="button" onClick={() => onShare(saved)} className={`${action} bg-primary-700 text-white hover:bg-primary-900`}>
            <Share2 className="size-5" aria-hidden="true" /> Share
          </button>
        ) : null}
        {confirm === "link" ? null : (
          <button type="button" disabled={pending} onClick={() => (saved && !removed ? setConfirm("link") : run(() => newLinkAction({ circleId, memberId: person.id }), onNewLink))} className={`${action} border border-border-200 bg-white text-primary-700 hover:bg-sky-100`}>
            <Link2 className="size-5" aria-hidden="true" /> New link
          </button>
        )}
        {removed || confirm === "remove" ? null : (
          <button type="button" disabled={pending} onClick={() => setConfirm("remove")} className={`${action} border border-border-200 bg-white text-attn-ink hover:bg-attn-bg`}>
            <Trash2 className="size-5" aria-hidden="true" /> Remove
          </button>
        )}
      </div>

      {confirm === "link" ? (
        <div role="group" aria-label={`Confirm a new link for ${first}`} className="space-y-2 rounded-xl border border-border-200 bg-white p-3">
          <p className="text-[15px] text-ink-900">The link {first} has now will stop working. Make a new one?</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={pending} onClick={() => run(() => newLinkAction({ circleId, memberId: person.id }), onNewLink)} className={`${action} bg-primary-700 text-white hover:bg-primary-900`}>
              Yes, new link
            </button>
            <button type="button" onClick={() => setConfirm(null)} className={`${action} text-ink-500 hover:bg-paper-100`}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}
      {confirm === "remove" ? (
        <div role="group" aria-label={`Confirm removing ${first}`} className="space-y-2 rounded-xl border border-attn/30 bg-white p-3">
          <p className="text-[15px] text-ink-900">{first} will no longer be able to open the circle.</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                run(
                  () => revokeMemberAction({ circleId, memberId: person.id }),
                  (result) => {
                    if (result.ok) forgetLink(circleId, person.id);
                    onChanged(result);
                  },
                )
              }
              className={`${action} border-2 border-attn bg-white text-attn-ink hover:bg-attn-bg`}
            >
              Yes, remove {first}
            </button>
            <button type="button" onClick={() => setConfirm(null)} className={`${action} text-ink-500 hover:bg-paper-100`}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {!removed ? (
        <details className="rounded-xl border border-border-200 bg-white p-3">
          <summary className="min-h-8 cursor-pointer text-[15px] font-semibold text-ink-900">More: what {first} sees, role, 90 more days</summary>
          <div className="mt-4 space-y-5">
            <WhatCanSee name={person.name} hidden={hidden} setHidden={setHidden} />
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => setVisibilityAction({ circleId, memberId: person.id, visibility: { hidden } }))}
              className={`${action} w-full border border-primary-700 bg-white text-primary-700 hover:bg-sky-100`}
            >
              Save what {first} sees
            </button>
            <div>
              <label className="text-[15px] font-semibold text-ink-900" htmlFor={`role-${person.id}`}>
                Role
              </label>
              <div className="mt-1.5 flex flex-col gap-2 sm:flex-row">
                <select id={`role-${person.id}`} value={role} onChange={(event) => setRole(event.target.value as HelperRole)} className={`${field} mt-0`}>
                  {HELPER_ROLES.map((item) => (
                    <option key={item} value={item}>
                      {HELPER_ROLE_LABELS[item]}
                    </option>
                  ))}
                </select>
                <button type="button" disabled={pending} onClick={() => run(() => changeRoleAction({ circleId, memberId: person.id, role }))} className={`${action} border border-border-200 bg-white text-primary-700 hover:bg-sky-100`}>
                  Save role
                </button>
              </div>
            </div>
            <button type="button" disabled={pending} onClick={() => run(() => renewMemberAction({ circleId, memberId: person.id }))} className={`${action} w-full border border-border-200 bg-white text-ink-900 hover:bg-paper-100`}>
              Keep the link working 90 more days
            </button>
            {person.expiresAt ? <p className="text-[13px] text-ink-500">The link works until {dateTime(person.expiresAt)}, and each visit extends it.</p> : null}
          </div>
        </details>
      ) : null}
    </div>
  );
}
