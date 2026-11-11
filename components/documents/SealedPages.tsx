"use client";

import { FileText, Loader2, Lock } from "lucide-react";
import { useEffect, useState } from "react";
import { RestoreKeys } from "@/components/circles/RestoreKeys";
import { loadCircleKey, openPage, unwrapFileKey } from "@/lib/crypto";
import type { CircleKeyStatus } from "@/lib/schema/circles";
import type { StoredDocumentKey } from "@/lib/schema/documents";

type Props = {
  circleId: string;
  documentId: string;
  kind: "photos" | "pdf";
  saved: number;
  fileKey: StoredDocumentKey;
  /** The circle's key as this caregiver's account has it, so the recovery words can be asked for here. */
  circleKey: CircleKeyStatus | null;
};

/**
 * Shows a saved summary whose pages are encrypted. The pages arrive from the server still encrypted;
 * this device opens the summary's file key with the circle key it holds, then opens each page.
 * Without the circle key on this device, nothing can be shown, and the recovery words are asked for.
 */
export function SealedPages({ circleId, documentId, kind, saved, fileKey, circleKey }: Props) {
  const [state, setState] = useState<"opening" | "no-key" | "open" | "failed">("opening");
  const [urls, setUrls] = useState<(string | null)[]>(() => Array.from({ length: saved }, () => null));
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancel = false;
    const made: string[] = [];
    (async () => {
      setState("opening");
      const local = await loadCircleKey(circleId).catch(() => null);
      if (cancel) return;
      if (!local || local.keyVersion !== fileKey.keyVersion) {
        setState("no-key");
        return;
      }
      try {
        const key = await unwrapFileKey(fileKey, local.key);
        for (let n = 1; n <= saved; n++) {
          const response = await fetch(`/api/circles/${circleId}/documents/${documentId}/pages/${n}`, { cache: "no-store" });
          if (!response.ok) throw new Error("fetch");
          const plain = await openPage(new Uint8Array(await response.arrayBuffer()), key, documentId, n);
          if (cancel) return;
          const url = URL.createObjectURL(new Blob([plain.buffer as ArrayBuffer], { type: kind === "pdf" ? "application/pdf" : "image/jpeg" }));
          made.push(url);
          setUrls((all) => all.map((item, index) => (index === n - 1 ? url : item)));
        }
        if (!cancel) setState("open");
      } catch {
        if (!cancel) setState("failed");
      }
    })();
    return () => {
      cancel = true;
      for (const url of made) URL.revokeObjectURL(url);
    };
  }, [circleId, documentId, kind, saved, fileKey, attempt]);

  if (state === "no-key") {
    return (
      <div className="max-w-xl rounded-lg border border-border-200 bg-white p-5">
        <Lock className="size-6 text-primary-700" aria-hidden="true" />
        <h2 className="mt-2 text-[16px] font-semibold text-ink-900">This device does not have the key yet</h2>
        <p className="mt-1 text-[14px] text-ink-500">
          These pages were locked with a key only you hold. Enter your recovery words once on this device to open them. All Hands Care does not have the key and cannot open them for you.
        </p>
        {circleKey ? <RestoreKeys circles={[circleKey]} onReady={() => setAttempt((n) => n + 1)} /> : null}
      </div>
    );
  }

  if (state === "failed") {
    return (
      <div role="alert" className="max-w-xl rounded-lg bg-attn-bg px-4 py-3 text-[14px] text-attn-ink">
        The pages could not be opened. Check the connection and try again.
        <button type="button" onClick={() => setAttempt((n) => n + 1)} className="ml-2 font-semibold underline underline-offset-2">
          Try again
        </button>
      </div>
    );
  }

  const waiting = (
    <p role="status" className="flex items-center gap-2 px-4 py-6 text-[14px] text-ink-500">
      <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Opening on this device
    </p>
  );

  if (kind === "pdf") {
    return urls[0] ? (
      <a
        href={urls[0]}
        target="_blank"
        rel="noreferrer"
        className="inline-flex min-h-12 items-center gap-2 rounded-lg bg-primary-700 px-5 text-[16px] font-semibold text-white hover:bg-primary-900"
      >
        <FileText className="size-5" aria-hidden="true" /> Open the PDF
      </a>
    ) : (
      waiting
    );
  }

  return (
    <ol className="space-y-4">
      {urls.map((url, index) => (
        <li key={index} className="overflow-hidden rounded-lg border border-border-200 bg-white">
          <p className="border-b border-border-200 px-4 py-2 text-[13px] font-semibold text-ink-500">
            Page {index + 1} of {saved}
          </p>
          {url ? (
            <a href={url} target="_blank" rel="noreferrer" aria-label={`Open page ${index + 1} full size`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt={`Page ${index + 1} of the after-visit summary`} className="block h-auto w-full" />
            </a>
          ) : (
            waiting
          )}
        </li>
      ))}
    </ol>
  );
}
