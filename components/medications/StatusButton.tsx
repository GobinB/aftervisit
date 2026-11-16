"use client";

import { useState } from "react";
import { setMedicationStatusAction } from "@/app/actions/medications";

/** Stop keeps the medication on the record, dated. Restart puts it back on the list. */
export function StatusButton({ circleId, id, name, status }: { circleId: string; id: string; name: string; status: "active" | "stopped" }) {
  // Its own flag rather than useTransition, and no router.refresh(): the action refreshes the
  // medication pages itself (app/actions/medications.ts). Tied to a transition, the button could stay
  // on "Saving" for good in a production build.
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const next = status === "active" ? "stopped" : "active";
  return (
    <span className="inline-flex flex-col items-end">
      <button
        type="button"
        disabled={pending}
        aria-label={`${next === "stopped" ? "Stop" : "Restart"} ${name}`}
        className="inline-flex h-8 items-center rounded-md border border-border-200 bg-white px-2.5 text-[12px] font-medium text-ink-900 hover:bg-paper-100 disabled:opacity-50"
        onClick={() => {
          if (next === "stopped" && !window.confirm(`Mark ${name} as stopped? It stays on the record with today's date.`)) return;
          setError(null);
          setPending(true);
          void (async () => {
            try {
              const result = await setMedicationStatusAction({ circleId, id, status: next });
              if (!result.ok) setError(result.error);
            } catch {
              setError("That did not save. Check your connection and try again.");
            } finally {
              setPending(false);
            }
          })();
        }}
      >
        {pending ? "Saving" : next === "stopped" ? "Stop" : "Restart"}
      </button>
      {error ? (
        <span role="alert" className="mt-1 text-[12px] text-attn-ink">
          {error}
        </span>
      ) : null}
    </span>
  );
}
