"use client";

import { Hand } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { goToEventAction } from "@/app/actions/events";

/** "I'll go" on an event that asks for someone. */
export function GoButton({ circleId, id }: { circleId: string; id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-col items-end">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setError(null);
          start(async () => {
            const result = await goToEventAction({ circleId, id });
            if (!result.ok) setError(result.error);
            router.refresh();
          });
        }}
        className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary-700 px-2.5 text-[12px] font-semibold text-white hover:bg-primary-900 disabled:opacity-50"
      >
        <Hand className="size-3.5" aria-hidden="true" /> {pending ? "Saving" : "I'll go"}
      </button>
      {error ? (
        <span role="alert" className="mt-1 text-[12px] text-attn-ink">
          {error}
        </span>
      ) : null}
    </span>
  );
}
