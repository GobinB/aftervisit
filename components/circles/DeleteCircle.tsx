"use client";

import { useState, useTransition } from "react";
import { deleteCircle } from "@/app/actions/circles";
import { Button } from "@/components/ui/Button";

export function DeleteCircle({ circleId }: { circleId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!confirming) {
    return (
      <Button variant="danger" className="w-full" onClick={() => setConfirming(true)}>
        Delete circle
      </Button>
    );
  }

  return (
    <div className="rounded-2xl border border-attn bg-attn-bg p-4" role="group" aria-label="Confirm delete">
      <p className="text-attn-ink">Nobody can open it again, every link stops working, and it is erased for good after 30 days.</p>
      {error ? (
        <p role="alert" className="mt-2 text-attn-ink">
          {error}
        </p>
      ) : null}
      <div className="mt-4 flex flex-col gap-2">
        <Button
          variant="danger"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const result = await deleteCircle(circleId);
              if (result && !result.ok) setError(result.error);
            })
          }
        >
          {pending ? "Deleting" : "Delete"}
        </Button>
        <Button variant="secondary" onClick={() => setConfirming(false)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
