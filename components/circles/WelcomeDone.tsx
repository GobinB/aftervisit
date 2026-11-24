"use client";

import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { welcomeDoneAction } from "@/app/actions/welcome";

/** Got it on the first-open welcome. The page then shows who runs the circle in its usual short line. */
export function WelcomeDone({ circleId }: { circleId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await welcomeDoneAction({ circleId });
          router.refresh();
        })
      }
      className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary-700 px-4 text-label font-semibold text-white shadow-sm hover:bg-primary-900 disabled:opacity-60"
    >
      <Check className="size-4" aria-hidden="true" />
      Got it
    </button>
  );
}
