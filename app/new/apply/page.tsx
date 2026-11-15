"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { visitContextAction, type VisitContext } from "@/app/actions/visits";
import { ApplyVisit } from "@/components/handoff/ApplyVisit";
import { StepHeader } from "@/components/StepHeader";
import { reviewComplete } from "@/lib/review";
import { useFlow } from "@/lib/store";

/** The last step for a visit started from a circle: load the circle, then choose what goes into it. */
export default function ApplyVisitPage() {
  const router = useRouter();
  const { draft, circleId, reviewed } = useFlow();
  const [context, setContext] = useState<VisitContext | null>(null);
  const [hydrated, setHydrated] = useState(false);
  // Nothing reaches the circle until both review steps are confirmed, however this page was opened.
  const checked = reviewComplete(draft, reviewed);

  useEffect(() => {
    // The draft comes back from this tab's storage after the page loads (a reload, or the address typed in).
    if (useFlow.persist.hasHydrated()) setHydrated(true);
    return useFlow.persist.onFinishHydration(() => setHydrated(true));
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (!draft || !circleId) {
      router.replace("/new");
      return;
    }
    if (!checked) {
      router.replace("/new/review");
      return;
    }
    visitContextAction(circleId)
      .then(setContext)
      .catch(() => setContext({ ok: false, error: "The circle could not be loaded. Try again." }));
  }, [hydrated, draft, circleId, checked, router]);

  if (!hydrated || !draft || !circleId || !checked) return null;
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
