"use client";

import { useTransition } from "react";
import { signOut } from "@/app/(auth)/login/actions";
import { clearCircleKeys } from "@/lib/crypto";
import { forgetAllLinks } from "@/lib/local-links";

/** Removes this device's circle keys and saved helper links, then ends the session. Signing in again here asks for the recovery words. */
export function SignOut() {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      className="rounded-lg px-2 py-2 font-medium text-primary-700 disabled:opacity-50"
      onClick={() =>
        start(async () => {
          await clearCircleKeys().catch(() => undefined);
          forgetAllLinks();
          await signOut();
        })
      }
    >
      {pending ? "Signing out" : "Sign out"}
    </button>
  );
}
