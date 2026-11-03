"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addMemberAction, changeRoleAction, newLinkAction, renewMemberAction, revokeMemberAction, setVisibilityAction } from "@/app/actions/members";
import { urlForMemberToken } from "@/components/circles/member-link";
import { ShareLink } from "@/components/circles/ShareLink";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { dateTime } from "@/lib/format";
import { SHARE_SECTION_LABELS, SHARE_SECTIONS, type ShareSection } from "@/lib/schema";
import { AREA_LABELS, HELPER_ROLES, HELPER_ROLE_LABELS, READY_AREAS, type HelperRole, type PersonView, type Visibility, type VisibilityArea } from "@/lib/schema/circles";

const field =
  "mt-1.5 w-full min-h-12 rounded-xl border border-border-200 bg-white px-3 text-base text-ink-900 outline-none focus:border-action-500";

export function MembersPanel({
  circleId,
  people,
  canManage,
  keyVersion,
}: {
  circleId: string;
  people: PersonView[];
  canManage: boolean;
  keyVersion: number | null;
}) {
  const router = useRouter();
  const [link, setLink] = useState<{ url: string; name: string; email: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function saved(result: { ok: boolean; error?: string; token?: string; name?: string; email?: string | null }) {
    if (!result.ok) {
      setError(result.error ?? "That could not be saved. Try again.");
      return;
    }
    setError(null);
    if (result.token && result.name) {
      const built = await urlForMemberToken(circleId, result.token, keyVersion);
      if (!built.ok) setError(built.error);
      else setLink({ url: built.url, name: result.name, email: result.email ?? null });
    }
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {link ? <ShareLink link={link} onDone={() => setLink(null)} /> : null}
      {error ? (
        <p role="alert" className="rounded-xl bg-attn-bg px-3 py-2 text-attn-ink">
          {error}
        </p>
      ) : null}
      {canManage ? <AddPerson circleId={circleId} onDone={saved} /> : null}
      <ul className="space-y-3">
        {people.map((person) => (
          <li key={`${person.kind}-${person.id}`} className="rounded-2xl border border-border-200 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-ink-900">{person.name}</p>
                <p className="text-sm text-ink-500">{person.roleLabel}</p>
                {canManage && person.kind === "member" ? (
                  <p className="text-sm text-ink-500">Last opened {person.lastSeenAt ? dateTime(person.lastSeenAt) : "not yet"}</p>
                ) : null}
              </div>
              {person.revokedAt ? <Badge tone="attn">Access removed</Badge> : null}
              {person.locked ? <Badge tone="attn">Locked</Badge> : null}
            </div>
            {canManage && person.kind === "member" ? <MemberControls circleId={circleId} person={person} onDone={saved} /> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

function AddPerson({
  circleId,
  onDone,
}: {
  circleId: string;
  onDone: (result: { ok: boolean; error?: string; token?: string; name?: string; email?: string | null }) => void;
}) {
  const [role, setRole] = useState<HelperRole>("family");
  const [hidden, setHidden] = useState<VisibilityArea[]>([]);
  const [sections, setSections] = useState<ShareSection[]>([]);
  const [pending, start] = useTransition();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const pin = String(form.get("pin") ?? "").trim();
    const visibility: Visibility = {};
    if (hidden.length) visibility.hidden = hidden;
    if (sections.length) visibility.handoffSections = sections;
    start(async () => {
      const result = await addMemberAction({
        circleId,
        name: String(form.get("name") ?? ""),
        role,
        email: email || undefined,
        pin: pin || undefined,
        visibility,
      });
      await onDone(result);
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-border-200 bg-white p-4">
      <h2 className="font-display text-xl text-ink-900">Add a person</h2>
      <div>
        <label htmlFor="member-name" className="font-medium">
          Name
        </label>
        <input id="member-name" name="name" required className={field} />
      </div>
      <fieldset>
        <legend className="font-medium">Role</legend>
        <div className="mt-2 grid gap-2">
          {HELPER_ROLES.map((item) => (
            <label key={item} className="flex min-h-12 items-center gap-3 rounded-xl border border-border-200 px-3">
              <input type="radio" name="role" value={item} checked={role === item} onChange={() => setRole(item)} />
              {HELPER_ROLE_LABELS[item]}
            </label>
          ))}
        </div>
      </fieldset>
      <div>
        <label htmlFor="member-email" className="font-medium">
          Email <span className="font-normal text-ink-500">(optional, for your mail app)</span>
        </label>
        <input id="member-email" name="email" type="email" autoComplete="email" className={field} />
      </div>
      <div>
        <label htmlFor="member-pin" className="font-medium">
          PIN <span className="font-normal text-ink-500">(optional)</span>
        </label>
        <input id="member-pin" name="pin" inputMode="numeric" autoComplete="off" pattern="\d{4}" maxLength={4} className={field} />
        <p className="mt-1 text-sm text-ink-500">Share a PIN by voice or a different message. AfterVisit does not send it.</p>
      </div>
      <SectionPicker hidden={hidden} setHidden={setHidden} sections={sections} setSections={setSections} />
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Adding" : "Add and show link"}
      </Button>
    </form>
  );
}

function MemberControls({
  circleId,
  person,
  onDone,
}: {
  circleId: string;
  person: PersonView;
  onDone: (result: { ok: boolean; error?: string; token?: string; name?: string; email?: string | null }) => void;
}) {
  const [role, setRole] = useState<HelperRole>((HELPER_ROLES as readonly string[]).includes(person.role) ? (person.role as HelperRole) : "family");
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();
  const [hidden, setHidden] = useState<VisibilityArea[]>([]);
  const [sections, setSections] = useState<ShareSection[]>([]);

  const run = (work: () => Promise<{ ok: boolean; error?: string; token?: string; name?: string; email?: string | null }>) => {
    start(async () => {
      await onDone(await work());
    });
  };

  return (
    <div className="mt-4 space-y-3 border-t border-border-200 pt-4">
      <div className="flex flex-col gap-2 sm:flex-row">
        <label className="sr-only" htmlFor={`role-${person.id}`}>
          Role for {person.name}
        </label>
        <select id={`role-${person.id}`} value={role} onChange={(event) => setRole(event.target.value as HelperRole)} className={field}>
          {HELPER_ROLES.map((item) => (
            <option key={item} value={item}>
              {HELPER_ROLE_LABELS[item]}
            </option>
          ))}
        </select>
        <Button variant="secondary" disabled={pending} onClick={() => run(() => changeRoleAction({ circleId, memberId: person.id, role }))}>
          Save role
        </Button>
      </div>
      <details className="rounded-xl bg-surface-50 p-3">
        <summary className="cursor-pointer font-medium">Show or hide sections</summary>
        <div className="mt-3">
          <SectionPicker hidden={hidden} setHidden={setHidden} sections={sections} setSections={setSections} />
          <Button className="mt-3 w-full" variant="secondary" disabled={pending} onClick={() => run(() => setVisibilityAction({ circleId, memberId: person.id, visibility: { hidden, handoffSections: sections } }))}>
            Save what they can see
          </Button>
        </div>
      </details>
      <div className="grid gap-2">
        <Button variant="secondary" disabled={pending} onClick={() => run(() => renewMemberAction({ circleId, memberId: person.id }))}>
          Renew 90 days
        </Button>
        <Button variant="secondary" disabled={pending} onClick={() => run(() => newLinkAction({ circleId, memberId: person.id }))}>
          New link
        </Button>
        {confirming ? (
          <div className="grid gap-2" role="group" aria-label={`Confirm removing ${person.name}`}>
            <Button variant="danger" disabled={pending} onClick={() => run(() => revokeMemberAction({ circleId, memberId: person.id }))}>
              Confirm removal
            </Button>
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
          </div>
        ) : (
          <Button variant="danger" onClick={() => setConfirming(true)}>
            Remove access
          </Button>
        )}
      </div>
    </div>
  );
}

function SectionPicker({
  hidden,
  setHidden,
  sections,
  setSections,
}: {
  hidden: VisibilityArea[];
  setHidden: (next: VisibilityArea[]) => void;
  sections: ShareSection[];
  setSections: (next: ShareSection[]) => void;
}) {
  return (
    <div className="space-y-3">
      <fieldset>
        <legend className="text-sm font-medium text-ink-500">Areas</legend>
        <div className="mt-2 grid gap-2">
          {READY_AREAS.map((area) => {
            const shown = !hidden.includes(area);
            return (
              <label key={area} className="flex min-h-11 items-center justify-between gap-3">
                <span>{AREA_LABELS[area]}</span>
                <input
                  type="checkbox"
                  checked={shown}
                  aria-label={`${shown ? "Showing" : "Hiding"} ${AREA_LABELS[area]}`}
                  onChange={() => setHidden(shown ? [...hidden, area] : hidden.filter((item) => item !== area))}
                  className="h-5 w-5 accent-primary-700"
                />
              </label>
            );
          })}
        </div>
        <p className="mt-1 text-sm text-ink-500">Other areas appear here once they are available.</p>
      </fieldset>
      {READY_AREAS.includes("handoff") ? (
        <fieldset>
          <legend className="text-sm font-medium text-ink-500">Handoff sections</legend>
          <div className="mt-2 grid gap-2">
            {SHARE_SECTIONS.map((section) => (
              <label key={section} className="flex min-h-11 items-center gap-3">
                <input
                  type="checkbox"
                  checked={sections.includes(section)}
                  onChange={() => setSections(sections.includes(section) ? sections.filter((item) => item !== section) : [...sections, section])}
                  className="h-5 w-5 accent-primary-700"
                />
                {SHARE_SECTION_LABELS[section]}
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}
    </div>
  );
}

