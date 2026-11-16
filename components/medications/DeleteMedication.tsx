"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { deleteMedicationAction } from "@/app/actions/medications";

/**
 * Deletes a medication added by mistake, after one plain question on the page. Its history goes too,
 * so the question points to Stop for a medicine that was really taken and has ended.
 */
export function DeleteMedication({ circleId, id, name }: { circleId: string; id: string; name: string }) {
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function remove() {
    setError(null);
    setPending(true);
    void (async () => {
      try {
        const result = await deleteMedicationAction({ circleId, id });
        if (!result.ok) {
          setError(result.error);
          setPending(false);
          return;
        }
        // The action refreshes the medication pages; this only moves back to the list.
        router.push(`/circles/${circleId}/medications`);
      } catch {
        setError("That did not delete. Check your connection and try again.");
        setPending(false);
      }
    })();
  }

  if (!asking) {
    return (
      <button
        type="button"
        onClick={() => setAsking(true)}
        className="inline-flex min-h-12 items-center gap-2 rounded-lg border border-border-200 bg-white px-4 text-[15px] font-semibold text-attn-ink hover:bg-attn-bg"
      >
        <Trash2 className="size-5" aria-hidden="true" /> Delete this medication
      </button>
    );
  }
  return (
    <div role="group" aria-label={`Confirm deleting ${name}`} className="w-full space-y-3 rounded-lg border border-attn/30 bg-white p-4">
      <p className="text-[15px] text-ink-900">
        Delete {name} for good? It comes off the list and out of the history. If it was taken and has now ended, use Stop instead, so the
        record stays.
      </p>
      {error ? (
        <p role="alert" className="rounded-md bg-attn-bg px-3 py-2 text-[14px] text-attn-ink">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={remove}
          className="inline-flex min-h-12 items-center rounded-lg border-2 border-attn bg-white px-4 text-[15px] font-semibold text-attn-ink hover:bg-attn-bg disabled:opacity-50"
        >
          {pending ? "Deleting" : "Yes, delete it"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => setAsking(false)}
          className="inline-flex min-h-12 items-center rounded-lg px-4 text-[15px] font-semibold text-ink-500 hover:bg-paper-100"
        >
          Keep it
        </button>
      </div>
    </div>
  );
}
