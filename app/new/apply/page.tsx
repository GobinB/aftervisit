"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { visitContextAction, type VisitContext } from "@/app/actions/visits";
import { ApplyVisit } from "@/components/handoff/ApplyVisit";
import { StepHeader } from "@/components/StepHeader";
import { useFlow } from "@/lib/store";

/** The last step for a visit started from a circle: load the circle, then choose what goes into it. */
export default function ApplyVisitPage() {
  const router = useRouter();
  const { draft, circleId } = useFlow();
  const [context, setContext] = useState<VisitContext | null>(null);

  useEffect(() => {
    if (!draft || !circleId) {
      router.replace("/new");
      return;
    }
    visitContextAction(circleId)
      .then(setContext)
      .catch(() => setContext({ ok: false, error: "The circle could not be loaded. Try again." }));
  }, [draft, circleId, router]);

  if (!draft || !circleId) return null;
  if (!context) {
    return (
      <p className="mx-auto mt-16 flex max-w-[720px] items-center gap-2 text-ink-500">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Loading the circle
      </p>
    );
  }
  if (!context.ok) {
    return (
      <div className="mx-auto max-w-[720px]">
        <StepHeader current="Share" circle />
        <p role="alert" className="rounded-lg bg-attn-bg px-4 py-3 text-attn-ink">
          {context.error}
        </p>
      </div>
    );
  }
  return <ApplyVisit draft={draft} circleId={circleId} context={context} />;
}
