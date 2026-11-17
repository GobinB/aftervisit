"use client";

import { UsersRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveToAccountAction } from "@/app/actions/members";
import { Button, buttonClass } from "@/components/ui/Button";

/** On Today, for someone who opened the circle with their link. Optional; it never gets in the way. */
export function SaveToAccountCard({ circleId }: { circleId: string }) {
  return (
    <section aria-labelledby="save-account-title" className="rounded-2xl border border-border-200 bg-white p-4">
      <h2 id="save-account-title" className="flex items-center gap-2 text-[15px] font-semibold text-ink-900">
        <UsersRound className="size-5 shrink-0 text-primary-700" aria-hidden="true" />
        All your circles in one place
      </h2>
      <p className="mt-1.5 text-[14px] text-ink-500">Helping more than one person? Save this to your Google account and open every circle you are in by signing in. Optional.</p>
      <Link href={`/circles/${circleId}/account`} className={buttonClass("secondary", "mt-3 w-full")}>
        Save this to my account
      </Link>
    </section>
  );
}

/** The one tap that saves a person's link to the Google account they just signed in with. */
export function SaveToAccount({ circleId, email }: { circleId: string; email: string | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="mt-5">
      {error ? (
        <p role="alert" className="mb-3 rounded-xl bg-attn-bg px-3 py-2 text-attn-ink">
          {error}
        </p>
      ) : null}
      <Button
        className="w-full whitespace-normal"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const result = await saveToAccountAction(circleId);
            if (!result.ok) setError(result.error);
            else router.refresh();
          })
        }
      >
        {pending ? "Saving" : email ? `Save to ${email}` : "Save to my Google account"}
      </Button>
    </div>
  );
}
