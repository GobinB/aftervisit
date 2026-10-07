"use client";
import { Check, Copy, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { COPY } from "@/lib/copy";

export function CopyField({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex gap-2">
      <label className="sr-only" htmlFor="manage-share-link">
        {label}
      </label>
      <input
        id="manage-share-link"
        readOnly
        value={value}
        onFocus={(e) => e.target.select()}
        className="h-12 min-w-0 flex-1 rounded-lg border border-border-200 bg-white px-3 text-sm"
      />
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 2500);
          } catch {}
        }}
        className="inline-flex min-h-12 items-center gap-2 rounded-lg border border-border-200 bg-white px-3 font-semibold text-primary-700 hover:bg-sky-100"
      >
        {copied ? <Check size={18} aria-hidden="true" /> : <Copy size={18} aria-hidden="true" />}
        <span aria-live="polite">{copied ? "Copied" : "Copy"}</span>
      </button>
    </div>
  );
}

/** "Delete this handoff" with a confirmation dialog. Removes the stored original, then the row. */
export function DeleteHandoff({ token, manageKey }: { token: string; manageKey: string }) {
  const router = useRouter();
  const ref = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function del() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/handoffs/${token}`, { method: "DELETE", headers: { "x-manage-key": manageKey } });
      if (!res.ok) throw new Error();
      ref.current?.close();
      router.refresh();
    } catch {
      setError(COPY.genericError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => ref.current?.showModal()}
        className="inline-flex min-h-12 items-center gap-2 rounded-xl border-2 border-attn bg-white px-4 font-semibold text-attn-ink hover:bg-attn-bg"
      >
        <Trash2 size={18} aria-hidden="true" /> Delete this handoff
      </button>
      <dialog ref={ref} aria-labelledby="del-title" className="m-auto w-[min(26rem,calc(100vw-2rem))] rounded-2xl bg-white p-6 backdrop:bg-ink-900/50">
        <h2 id="del-title" className="text-xl font-semibold text-primary-900">
          Delete this handoff?
        </h2>
        <p className="mt-2 text-ink-500">The link will stop working for everyone right away. This cannot be undone.</p>
        {error ? (
          <p role="alert" className="mt-3 text-attn-ink">
            {error}
          </p>
        ) : null}
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={() => ref.current?.close()} className="min-h-12 rounded-xl px-4 font-medium text-primary-700 hover:bg-sky-100">
            Keep it
          </button>
          <button type="button" onClick={del} disabled={busy} className="min-h-12 rounded-xl bg-attn px-4 font-semibold text-white hover:bg-attn-ink disabled:opacity-60">
            {busy ? "Deleting…" : "Delete"}
          </button>
        </div>
      </dialog>
    </>
  );
}
