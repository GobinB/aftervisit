"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteDocumentAction } from "@/app/actions/documents";

/** Deletes the saved photos for good, after one plain question. */
export function DeleteDocument({ circleId, id }: { circleId: string; id: string }) {
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (!asking) {
    return (
      <button
        type="button"
        onClick={() => setAsking(true)}
        className="inline-flex min-h-12 items-center gap-2 rounded-lg border border-border-200 bg-white px-4 text-[15px] font-semibold text-attn-ink hover:bg-attn-bg"
      >
        <Trash2 className="size-5" aria-hidden="true" /> Delete these photos
      </button>
    );
  }
  return (
    <div role="group" aria-label="Confirm delete" className="space-y-3 rounded-lg border border-attn/30 bg-white p-4">
      <p className="text-[15px] text-ink-900">Delete these photos for good? The medicines, reminders and appointments from this visit stay.</p>
      {error ? (
        <p role="alert" className="rounded-md bg-attn-bg px-3 py-2 text-[14px] text-attn-ink">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const result = await deleteDocumentAction({ circleId, id });
              if (!result.ok) setError(result.error);
              else router.push(`/circles/${circleId}/visits`);
            })
          }
          className="inline-flex min-h-12 items-center rounded-lg border-2 border-attn bg-white px-4 text-[15px] font-semibold text-attn-ink hover:bg-attn-bg disabled:opacity-50"
        >
          {pending ? "Deleting" : "Yes, delete"}
        </button>
        <button type="button" onClick={() => setAsking(false)} className="inline-flex min-h-12 items-center rounded-lg px-4 text-[15px] font-semibold text-ink-500 hover:bg-paper-100">
          Cancel
        </button>
      </div>
    </div>
  );
}
