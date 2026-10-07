"use client";
import { Lock } from "lucide-react";
import { useState } from "react";
import { LogoMark } from "@/components/Logo";
import { PinInput } from "@/components/PinInput";
import { COPY } from "@/lib/copy";
import type { HandoffView, TaskStatusView } from "@/lib/schema";
import { HandoffDocument } from "./HandoffDocument";

async function postAck(token: string, name: string, pin?: string) {
  try {
    const res = await fetch(`/api/handoffs/${token}/ack`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, pin }),
    });
    if (res.ok) return { ok: true as const };
    const data = await res.json().catch(() => ({}));
    if (res.status === 410) return { ok: false as const, message: data.status === "deleted" ? COPY.deleted : COPY.expired };
    return { ok: false as const, message: data.message || COPY.genericError };
  } catch {
    return { ok: false as const, message: COPY.offline };
  }
}

/** A handoff without a PIN, rendered from server data. */
export function LiveHandoff({ view, originalUrl, autoPrint }: { view: HandoffView; originalUrl: string | null; autoPrint?: boolean }) {
  return <HandoffDocument view={view} originalUrl={originalUrl} autoPrint={autoPrint} onAck={(name) => postAck(view.token, name)} />;
}

/** The fictional demo handoff: acknowledgment stays on this device. */
export function DemoHandoff({ view }: { view: HandoffView }) {
  return (
    <>
      <div className="no-print bg-med-bg px-4 py-2 text-center text-sm text-med-ink">
        Fictional sample: Margaret, the clinic and everyone named here are made up. Nothing here is stored.
      </div>
      <HandoffDocument view={view} onAck={async () => ({ ok: true })} />
    </>
  );
}

/** Centered card with four digit boxes. The PIN goes in a POST body, never the URL. */
export function PinGate({ token, autoPrint }: { token: string; autoPrint?: boolean }) {
  return (
    <PinPrompt
      endpoint={`/api/handoffs/${token}`}
      render={(d) => (
        <HandoffDocument view={d.view} originalUrl={d.originalUrl} autoPrint={autoPrint} onAck={(name) => postAck(token, name, d.pin)} />
      )}
    />
  );
}

type Unlocked = { view: HandoffView; originalUrl: string | null; pin: string };

function PinPrompt({ endpoint, render }: { endpoint: string; render: (d: Unlocked) => React.ReactNode }) {
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [data, setData] = useState<Unlocked | null>(null);

  async function submit(value: string) {
    if (busy || !/^\d{4}$/.test(value)) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: value }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok && body.handoff) {
        setData({ view: body.handoff, originalUrl: body.originalUrl ?? null, pin: value });
        return;
      }
      if (body.status === "locked") {
        setLocked(true);
        setMessage(COPY.pinLocked);
      } else if (body.status === "wrong_pin") {
        setMessage(COPY.pinWrong(body.attemptsLeft));
      } else if (res.status === 410) {
        setMessage(body.status === "deleted" ? COPY.deleted : body.status === "revoked" ? COPY.revoked : COPY.expired);
      } else {
        setMessage(COPY.genericError);
      }
      setPin("");
    } catch {
      setMessage(COPY.offline);
    } finally {
      setBusy(false);
    }
  }

  if (data) return <>{render(data)}</>;

  return (
    <div className="flex min-h-dvh items-center justify-center bg-surface-50 px-4">
      <main id="main" className="w-full max-w-sm rounded-2xl border border-border-200 bg-white p-7 text-center shadow-sm">
        <div className="mx-auto flex w-fit items-center gap-2.5 text-primary-900">
          <LogoMark size={36} />
          <span className="text-lg font-semibold">Care update</span>
        </div>
        <div className="mx-auto mt-6 flex h-12 w-12 items-center justify-center rounded-full bg-sky-100 text-primary-700">
          <Lock size={22} aria-hidden="true" />
        </div>
        <h1 className="font-display mt-3 text-xl font-medium text-primary-900">Enter the 4-digit PIN</h1>
        <p className="mt-1 text-ink-500">The person who shared this sent the PIN separately.</p>
        <form
          className="mt-6"
          onSubmit={(e) => {
            e.preventDefault();
            submit(pin);
          }}
        >
          <PinInput label="PIN" value={pin} onChange={setPin} onComplete={submit} autoFocus disabled={busy || locked} invalid={!!message} />
          <p role="alert" aria-live="assertive" className="mt-4 min-h-6 text-attn-ink">
            {message}
          </p>
          <button
            type="submit"
            disabled={busy || locked || pin.length !== 4}
            className="mt-2 min-h-12 w-full rounded-xl bg-primary-700 font-semibold text-white disabled:opacity-50"
          >
            {busy ? "Checking…" : "Open"}
          </button>
        </form>
      </main>
    </div>
  );
}

async function postJson(url: string, body: unknown) {
  try {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (res.ok) return { ok: true as const, data };
    if (res.status === 410) return { ok: false as const, message: data.status === "revoked" ? COPY.revoked : data.status === "deleted" ? COPY.deleted : COPY.expired };
    return { ok: false as const, message: data.message || COPY.genericError };
  } catch {
    return { ok: false as const, message: COPY.offline };
  }
}

function InviteDocument({ invite, view, originalUrl, pin }: { invite: string; view: HandoffView; originalUrl: string | null; pin?: string }) {
  return (
    <HandoffDocument
      view={view}
      originalUrl={originalUrl}
      onAck={async () => {
        const r = await postJson(`/api/invites/${invite}/ack`, { pin });
        return r.ok ? { ok: true } : r;
      }}
      onTaskUpdate={async (taskId, status, note) => {
        const r = await postJson(`/api/invites/${invite}/tasks`, { taskId, status, note, pin });
        return r.ok ? { ok: true, taskStatus: r.data.taskStatus } : r;
      }}
    />
  );
}

/** A personal invitation: rendered directly, or after the PIN when the handoff has one. */
export function InviteHandoff({ invite, view, originalUrl }: { invite: string; view?: HandoffView; originalUrl?: string | null }) {
  if (view) return <InviteDocument invite={invite} view={view} originalUrl={originalUrl ?? null} />;
  return <PinPrompt endpoint={`/api/invites/${invite}`} render={(d) => <InviteDocument invite={invite} view={d.view} originalUrl={d.originalUrl} pin={d.pin} />} />;
}

/** The caregiver's own complete view: every section, current statuses, no acknowledgment. */
export function CreatorView({
  view,
  taskStatus,
  originalUrl,
  autoPrint,
}: {
  view: HandoffView;
  taskStatus: Record<string, TaskStatusView>;
  originalUrl: string | null;
  autoPrint?: boolean;
}) {
  return <HandoffDocument view={view} taskStatus={taskStatus} originalUrl={originalUrl} creatorView autoPrint={autoPrint} />;
}
