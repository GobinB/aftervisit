"use client";
import { Check, Copy, Info, KeyRound, Lock, Mail, MessageSquare, Plus, Printer, ShieldCheck, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/Button";
import { DemoNotice } from "@/components/DemoNotice";
import { PinInput } from "@/components/PinInput";
import { inputClass } from "@/components/review/parts";
import { RoleChips } from "@/components/RoleChips";
import { StepHeader } from "@/components/StepHeader";
import { Switch } from "@/components/Switch";
import { COPY, emailBody, emailSubject, smsBody } from "@/lib/copy";
import { longDate } from "@/lib/format";
import type { Recipient } from "@/lib/schema";
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
  const [rows, setRows] = useState<Recipient[]>([]);
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

  const updateRow = (i: number, r: Recipient) => {
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
          shareUrl={created.shareUrl}
          manageUrl={created.manageUrl}
          expiresAt={created.expiresAt}
          sms={smsBody(draft, created.shareUrl, created.hasPin)}
          subject={emailSubject(draft)}
          email={emailBody(draft, created.shareUrl, caregiverFirstName.trim() || undefined, created.hasPin)}
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
              <PinInput label="Choose a PIN" value={pin} onChange={setPin} autoFocus />
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

function SuccessPanel({
  headingRef,
  pin,
  shareUrl,
  manageUrl,
  expiresAt,
  sms,
  subject,
  email,
  onAnother,
}: {
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  pin: string | null;
  shareUrl: string;
  manageUrl: string;
  expiresAt: string;
  sms: string;
  subject: string;
  email: string;
  onAnother: () => void;
}) {
  const [copied, setCopied] = useState<"link" | "manage" | null>(null);
  const copy = async (what: "link" | "manage") => {
    if (await copyText(what === "link" ? shareUrl : manageUrl)) {
      setCopied(what);
      setTimeout(() => setCopied(null), 2500);
    }
  };
  const action =
    "flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl border border-border-200 bg-white px-2 py-2 text-sm font-semibold text-primary-700 hover:bg-sky-100";

  return (
    <div className="animate-fade-in">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 animate-pop items-center justify-center rounded-full bg-ok-bg text-ok">
          <Check size={24} strokeWidth={3} aria-hidden="true" />
        </span>
        <h1 ref={headingRef} tabIndex={-1} className="font-display text-[1.6rem] leading-tight font-medium text-primary-900 outline-none">
          {COPY.shareSuccess}
        </h1>
      </div>

      <label htmlFor="share-link" className="mt-6 block font-medium">
        Share link
      </label>
      <input
        id="share-link"
        readOnly
        value={shareUrl}
        onFocus={(e) => e.target.select()}
        className={`mt-1 h-12 font-medium ${inputClass}`}
      />
      <p className="mt-1 text-sm text-ink-500">Expires {longDate(expiresAt)}.</p>
      {pin ? (
        <p className="mt-4 flex items-start gap-3 rounded-xl border border-border-200 bg-white px-4 py-3">
          <KeyRound size={20} className="mt-0.5 shrink-0 text-primary-700" aria-hidden="true" />
          <span>
            PIN: <strong className="font-mono text-lg tracking-[0.3em]">{pin}</strong>
            <span className="block text-sm text-ink-500">Send it separately, by voice or a different message. It is not shown again.</span>
          </span>
        </p>
      ) : (
        <p className="mt-4 text-sm text-ink-500">{COPY.pinOffWarning}</p>
      )}

      <div className="mt-4 grid grid-cols-4 gap-2">
        <button type="button" className={action} onClick={() => copy("link")}>
          {copied === "link" ? <Check size={20} aria-hidden="true" /> : <Copy size={20} aria-hidden="true" />}
          <span aria-live="polite">{copied === "link" ? "Copied" : "Copy link"}</span>
        </button>
        <a className={action} href={`sms:?&body=${encodeURIComponent(sms)}`}>
          <MessageSquare size={20} aria-hidden="true" />
          Text it
        </a>
        <a className={action} href={`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(email)}`}>
          <Mail size={20} aria-hidden="true" />
          Email it
        </a>
        <a className={action} href={`${shareUrl}?print=1`} target="_blank" rel="noreferrer">
          <Printer size={20} aria-hidden="true" />
          Print
        </a>
      </div>

      <div className="mt-8 rounded-2xl bg-primary-900 p-5 text-white">
        <div className="flex items-center gap-2 font-semibold">
          <ShieldCheck size={20} aria-hidden="true" /> Save your manage link
        </div>
        <p className="mt-2 text-white/90">
          This is your private manage link. It is the only way to see who has read the handoff or to delete it. Save it now.
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
            onClick={() => copy("manage")}
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
        <a href={shareUrl} target="_blank" rel="noreferrer" className="min-h-12 rounded-xl border-2 border-primary-700 px-5 py-2.5 text-center font-semibold text-primary-700 hover:bg-sky-100">
          View the handoff
        </a>
        <button type="button" onClick={onAnother} className="min-h-12 rounded-xl px-5 font-medium text-primary-700 hover:bg-sky-100">
          Create another handoff
        </button>
      </div>
    </div>
  );
}
