"use client";

import { Check, Hand } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { goToEventAction } from "@/app/actions/events";

/** "I'll go" on an event that asks for someone. */
export function GoButton({ circleId, id }: { circleId: string; id: string }) {
  const router = useRouter();
  const [, start] = useTransition();
  const [going, setGoing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-col items-end">
      <button
        type="button"
        disabled={going}
        onClick={() => {
          // Says "You're going" at once and saves in the background.
          setGoing(true);
          setError(null);
          start(async () => {
            const result = await goToEventAction({ circleId, id });
            if (!result.ok) {
              setGoing(false);
              setError(result.error);
            }
            router.refresh();
          });
        }}
        className={`inline-flex min-h-10 items-center gap-1.5 rounded-md px-3 text-[14px] font-semibold ${
          going ? "bg-ok-bg text-ok-ink" : "bg-primary-700 text-white hover:bg-primary-900"
        }`}
      >
        {going ? <Check className="size-4" aria-hidden="true" /> : <Hand className="size-4" aria-hidden="true" />}
        {going ? "You're going" : "I'll go"}
      </button>
      {error ? (
        <span role="alert" className="mt-1 text-[12px] text-attn-ink">
          {error}
        </span>
      ) : null}
    </span>
  );
}
