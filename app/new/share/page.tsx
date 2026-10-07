"use client";
import { Check, ChevronDown, Copy, Info, KeyRound, Lock, Mail, MessageSquare, Plus, Printer, ShieldCheck, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/Button";
import { DemoNotice } from "@/components/DemoNotice";
import { FeedbackCard } from "@/components/Feedback";
import { PinInput } from "@/components/PinInput";
import { inputClass } from "@/components/review/parts";
import { RoleChips } from "@/components/RoleChips";
import { StepHeader } from "@/components/StepHeader";
import { Switch } from "@/components/Switch";
import { COPY, emailBody, emailSubject, smsBody } from "@/lib/copy";
import { longDate } from "@/lib/format";
import { ROLE_LABELS, SHARE_SECTION_LABELS, SHARE_SECTIONS, type RecipientShare, type Role, type ShareSection } from "@/lib/schema";
import { activeSections, getOriginalFile, useFlow } from "@/lib/store";

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  }
}

export default function SharePage() {
  const router = useRouter();
  const flow = useFlow();
  const { draft, reviewed, recipients, setRecipients, caregiverFirstName, setCaregiver, created, setCreated, reset } = flow;
  const [hydrated, setHydrated] = useState(false);
  const [ready, setReady] = useState(false);
  const [rows, setRows] = useState<RecipientShare[]>([]);
  // PIN protection is on by default; the caregiver can turn it off.
  const [usePin, setUsePin] = useState(true);
  const [consent, setConsent] = useState(false);
  const [pin, setPin] = useState("");
  const [attach, setAttach] = useState(false);
  const [hasFile, setHasFile] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const successRef = useRef<HTMLHeadingElement>(null);
  const caregiverId = useId();

  useEffect(() => {
    if (useFlow.persist.hasHydrated()) setHydrated(true);
    return useFlow.persist.onFinishHydration(() => setHydrated(true));
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (!draft) return router.replace("/new");
    const allReviewed = activeSections(draft).every((k) => reviewed[k]);
    if (!allReviewed && !created) return router.replace("/new/review");
    setRows(recipients.length ? recipients : [{ name: "", role: "family" }]);
    setHasFile(!!getOriginalFile());
    setReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);
  useEffect(() => {
    if (created) {
      window.scrollTo({ top: 0 });
      successRef.current?.focus({ preventScroll: true });
    }
  }, [created]);

  // Render the form only once it is initialized, so nothing typed early is overwritten.
  if (!hydrated || !draft || (!ready && !created)) return <p className="py-20 text-center text-ink-500">Loading…</p>;

  const updateRow = (i: number, r: RecipientShare) => {
    const next = rows.map((x, j) => (j === i ? r : x));
    setRows(next);
    setRecipients(next.filter((x) => x.name.trim()));
  };

  async function create() {
    setError(null);
    const named = rows.map((r) => ({ ...r, name: r.name.trim() })).filter((r) => r.name);
    if (!named.length) return setError("Add at least one person to share with.");
    if (usePin && !/^\d{4}$/.test(pin)) return setError("Choose a 4-digit PIN, or turn the PIN off.");
    if (!consent) return setError(COPY.consentRequired);
    setBusy(true);
    try {
      const body = {
        draft,
        recipients: named,
        pin: usePin ? pin : undefined,
        createdByFirstName: caregiverFirstName.trim() || undefined,
        consent: true,
      };
      const file = attach ? getOriginalFile() : null;
      let res: Response;
      if (file) {
        const fd = new FormData();
        fd.append("data", JSON.stringify(body));
        fd.append("original", file, file.name);
        res = await fetch("/api/handoffs", { method: "POST", body: fd });
      } else {
        res = await fetch("/api/handoffs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || COPY.genericError);
      setRecipients(named);
      setCreated({ ...data, hasPin: usePin });
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : COPY.genericError);
    } finally {
      setBusy(false);
    }
  }

  if (created) {
    return (
      <div className="mx-auto max-w-[720px]">
        <StepHeader current="Done" />
        <SuccessPanel
          headingRef={successRef}
          pin={created.hasPin && /^\d{4}$/.test(pin) ? pin : null}
          invites={(created.invites ?? []).map((inv) => ({
            ...inv,
            sms: smsBody(draft, inv.url, created.hasPin, inv.name),
            email: emailBody(draft, inv.url, caregiverFirstName.trim() || undefined, created.hasPin, inv.name),
          }))}
          subject={emailSubject(draft)}
          manageUrl={created.manageUrl}
          expiresAt={created.expiresAt}
          isSample={flow.isSample}
          onAnother={() => {
            reset();
            router.push("/new");
          }}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[720px]">
      <StepHeader current="Share" />
      <h1 className="font-display text-[2.1rem] leading-tight font-medium text-primary-900">Who should see this?</h1>
      <p className="mt-2 text-ink-500">Add the people who help: family, a home aide, the day program, a care manager.</p>
      <DemoNotice className="mt-4" />

      <ul className="mt-6 space-y-4">
        {rows.map((r, i) => (
          <li key={i} className="rounded-2xl border border-border-200 bg-white p-4">
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <label htmlFor={`recipient-${i}`} className="text-sm font-medium">
                  Name
                </label>
                <input
                  id={`recipient-${i}`}
                  value={r.name}
                  maxLength={80}
                  autoComplete="off"
                  placeholder="First name or a front desk"
                  onChange={(e) => updateRow(i, { ...r, name: e.target.value })}
                  className={`mt-1 h-12 ${inputClass}`}
                />
              </div>
              {rows.length > 1 ? (
                <button
                  type="button"
                  className="mb-0.5 rounded-lg p-3 text-ink-500 hover:bg-attn-bg hover:text-attn-ink"
                  aria-label={`Remove ${r.name || "this person"}`}
                  onClick={() => {
                    const next = rows.filter((_, j) => j !== i);
                    setRows(next);
                    setRecipients(next.filter((x) => x.name.trim()));
                  }}
                >
                  <Trash2 size={20} aria-hidden="true" />
                </button>
              ) : null}
            </div>
            <div className="mt-3">
              <RoleChips name={r.name} value={r.role} onChange={(role) => updateRow(i, { ...r, role })} />
            </div>
            <Visibility row={r} index={i} hasFile={hasFile} onChange={(next) => updateRow(i, next)} />
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => setRows([...rows, { name: "", role: "family" }])}
        className="mt-3 inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 font-medium text-primary-700 hover:bg-sky-100"
      >
        <Plus size={18} aria-hidden="true" /> Add another person
      </button>

      <div className="mt-6 space-y-5 rounded-2xl border border-border-200 bg-white p-5">
        <div>
          <label htmlFor={caregiverId} className="font-medium">
            Your first name
          </label>
          <input
            id={caregiverId}
            value={caregiverFirstName}
            maxLength={60}
            autoComplete="given-name"
            onChange={(e) => setCaregiver(e.target.value)}
            className={`mt-1 h-12 ${inputClass}`}
          />
          <p className="mt-1 text-sm text-ink-500">Shown on the handoff so people know who prepared it.</p>
        </div>
        <div className="border-t border-border-200 pt-5">
          <Switch
            id="use-pin"
            checked={usePin}
            onChange={setUsePin}
            label="Protect with a 4-digit PIN"
            helper={usePin ? COPY.pinDefaultHelper : COPY.pinOffWarning}
          />
          {usePin ? (
            <div className="mt-4">
              <PinInput label="Choose a PIN" value={pin} onChange={setPin} />
            </div>
          ) : null}
        </div>
        {hasFile ? (
          <div className="border-t border-border-200 pt-5">
            <Switch
              id="attach"
              checked={attach}
              onChange={setAttach}
              label="Attach the original summary"
              helper="Useful for a home aide or day program. It is stored privately with this handoff and deleted with it."
            />
          </div>
        ) : null}
      </div>

      <p className="mt-5 flex gap-2.5 text-[0.95rem] text-ink-500">
        <Info size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
        {COPY.linkAccess}
      </p>

      <label htmlFor="consent" className="mt-5 flex cursor-pointer gap-3 rounded-2xl border border-border-200 bg-white p-4">
        <input
          id="consent"
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-0.5 h-6 w-6 shrink-0 cursor-pointer accent-primary-700"
        />
        <span>{COPY.consentLabel}</span>
      </label>

      {error ? (
        <p ref={errorRef} tabIndex={-1} role="alert" className="mt-5 rounded-xl bg-attn-bg px-4 py-3 text-attn-ink">
          {error}
        </p>
      ) : null}

      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
        <Link href="/new/review" className="min-h-12 rounded-xl px-4 py-3 text-center font-medium text-primary-700 hover:bg-sky-100">
          Back to review
        </Link>
        <Button className="w-full sm:w-auto sm:min-w-56" onClick={create} disabled={busy}>
          {busy ? "Creating…" : "Create handoff"}
        </Button>
      </div>
      <p className="mt-3 flex items-center gap-2 text-sm text-ink-500">
        <Lock size={14} aria-hidden="true" /> The link expires in 30 days. You can delete it any time.
      </p>
    </div>
  );
}

/** "What Lisa can see": sections and which next steps. Defaults to everything. */
function Visibility({ row, index, hasFile, onChange }: { row: RecipientShare; index: number; hasFile: boolean; onChange: (r: RecipientShare) => void }) {
  const sections = row.sections ?? [...SHARE_SECTIONS];
  const scope = row.tasksScope ?? "all";
  const shown = SHARE_SECTIONS.filter((s) => s !== "original" || hasFile);
  const everything = shown.every((s) => sections.includes(s)) && scope === "all";
  const toggle = (s: ShareSection, on: boolean) => onChange({ ...row, sections: on ? [...new Set([...sections, s])] : sections.filter((x) => x !== s) });
  return (
    <details className="group mt-3 rounded-xl border border-border-200">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 rounded-xl px-3 text-sm font-medium text-primary-700 [&::-webkit-details-marker]:hidden">
        <span>
          What {row.name.trim() || "this person"} can see: <span className="text-ink-500">{everything ? "everything" : "some sections"}</span>
        </span>
        <ChevronDown size={18} className="transition-transform group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div className="border-t border-border-200 px-3 pt-2 pb-3">
        <fieldset>
          <legend className="sr-only">Sections {row.name || "this person"} can see</legend>
          <div className="grid gap-1 sm:grid-cols-2">
            {shown.map((s) => (
              <label key={s} className="flex min-h-10 cursor-pointer items-center gap-2.5 text-[0.95rem]">
                <input
                  type="checkbox"
                  checked={sections.includes(s)}
                  onChange={(e) => toggle(s, e.target.checked)}
                  className="h-5 w-5 shrink-0 accent-primary-700"
                  aria-label={`${row.name || `Person ${index + 1}`} can see ${SHARE_SECTION_LABELS[s]}`}
                />
                {SHARE_SECTION_LABELS[s]}
              </label>
            ))}
          </div>
        </fieldset>
        {sections.includes("tasks") ? (
          <fieldset className="mt-2 border-t border-border-200 pt-2">
            <legend className="text-sm font-medium text-ink-900">Which next steps</legend>
            <div className="mt-1 flex flex-wrap gap-x-5">
              {(
                [
                  ["all", "All of them"],
                  ["mine", "Only steps assigned to them"],
                ] as const
              ).map(([v, label]) => (
                <label key={v} className="flex min-h-10 cursor-pointer items-center gap-2 text-[0.95rem]">
                  <input
                    type="radio"
                    name={`scope-${index}`}
                    checked={scope === v}
                    onChange={() => onChange({ ...row, tasksScope: v })}
                    className="h-5 w-5 accent-primary-700"
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
        ) : null}
      </div>
    </details>
  );
}

function SuccessPanel({
  headingRef,
  pin,
  invites,
  subject,
  manageUrl,
  expiresAt,
  isSample,
  onAnother,
}: {
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  pin: string | null;
  invites: { id: string; name: string; role: Role; url: string; sms: string; email: string }[];
  subject: string;
  manageUrl: string;
  expiresAt: string;
  isSample: boolean;
  onAnother: () => void;
}) {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = async (key: string, text: string) => {
    if (await copyText(text)) {
      setCopied(key);
      setTimeout(() => setCopied(null), 2500);
    }
  };
  const action =
    "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-border-200 bg-white px-3 text-sm font-semibold text-primary-700 hover:bg-sky-100";

  return (
    <div className="animate-fade-in">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 animate-pop items-center justify-center rounded-full bg-ok-bg text-ok">
          <Check size={24} strokeWidth={3} aria-hidden="true" />
        </span>
        <h1 ref={headingRef} tabIndex={-1} className="font-display text-[1.9rem] leading-tight font-medium text-primary-900 outline-none">
          Your handoff is ready.
        </h1>
      </div>
      <p className="mt-3 text-ink-500">
        Send each person their own link. Links are shown only once, so send them now. Everything expires {longDate(expiresAt)}.
      </p>

      {pin ? (
        <p className="mt-4 flex items-start gap-3 rounded-xl border border-border-200 bg-white px-4 py-3">
          <KeyRound size={20} className="mt-0.5 shrink-0 text-primary-700" aria-hidden="true" />
          <span>
            PIN: <strong className="font-mono text-lg tracking-[0.3em]">{pin}</strong>
            <span className="block text-sm text-ink-500">Everyone uses the same PIN. Send it separately, by voice or a different message.</span>
          </span>
        </p>
      ) : (
        <p className="mt-4 text-sm text-ink-500">{COPY.pinOffWarning}</p>
      )}

      <ul className="mt-5 space-y-3" aria-label="Personal links">
        {invites.map((inv) => (
          <li key={inv.id} className="rounded-2xl border border-border-200 bg-white p-4">
            <p className="font-semibold">
              {inv.name} <span className="font-normal text-ink-500">· {ROLE_LABELS[inv.role]}</span>
            </p>
            <label htmlFor={`invite-${inv.id}`} className="sr-only">
              Personal link for {inv.name}
            </label>
            <input
              id={`invite-${inv.id}`}
              readOnly
              value={inv.url}
              onFocus={(e) => e.target.select()}
              className={`mt-2 h-11 text-sm ${inputClass}`}
            />
            <div className="mt-2 grid grid-cols-3 gap-2">
              <button type="button" className={action} onClick={() => copy(inv.id, inv.url)}>
                {copied === inv.id ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
                <span aria-live="polite">{copied === inv.id ? "Copied" : "Copy"}</span>
              </button>
              <a className={action} href={`sms:?&body=${encodeURIComponent(inv.sms)}`} aria-label={`Text ${inv.name} their link`}>
                <MessageSquare size={16} aria-hidden="true" /> Text
              </a>
              <a
                className={action}
                href={`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(inv.email)}`}
                aria-label={`Email ${inv.name} their link`}
              >
                <Mail size={16} aria-hidden="true" /> Email
              </a>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-8 rounded-2xl bg-primary-900 p-5 text-white">
        <div className="flex items-center gap-2 font-semibold">
          <ShieldCheck size={20} aria-hidden="true" /> Save your manage link
        </div>
        <p className="mt-2 text-white/90">
          This is your private manage link. Use it to see who has read the handoff, follow next steps, remove someone&apos;s access, or delete
          it. Save it now.
        </p>
        <label htmlFor="manage-link" className="sr-only">
          Manage link
        </label>
        <input
          id="manage-link"
          readOnly
          value={manageUrl}
          onFocus={(e) => e.target.select()}
          className="mt-3 h-12 w-full rounded-lg border border-white/30 bg-white/10 px-3 text-sm text-white outline-none focus:ring-2 focus:ring-white/60"
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => copy("manage", manageUrl)}
            className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-white px-4 font-semibold text-primary-900 hover:bg-sky-100"
          >
            {copied === "manage" ? <Check size={18} aria-hidden="true" /> : <Copy size={18} aria-hidden="true" />}
            {copied === "manage" ? "Copied" : "Copy manage link"}
          </button>
          <a href={manageUrl} className="inline-flex min-h-12 items-center rounded-xl px-4 font-semibold text-white underline-offset-4 hover:underline">
            Open it
          </a>
        </div>
      </div>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <a
          href={manageUrl.replace("/manage?", "/manage/view?")}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border-2 border-primary-700 px-5 font-semibold text-primary-700 hover:bg-sky-100"
        >
          <Printer size={18} aria-hidden="true" /> View or print the full handoff
        </a>
        <button type="button" onClick={onAnother} className="min-h-12 rounded-xl px-5 font-medium text-primary-700 hover:bg-sky-100">
          Create another handoff
        </button>
      </div>

      {isSample ? (
        <div className="mt-10">
          <FeedbackCard context="demo" />
        </div>
      ) : null}
    </div>
  );
}
