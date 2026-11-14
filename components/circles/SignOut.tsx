"use client";

import { useTransition } from "react";
import { signOut } from "@/app/(auth)/login/actions";
import { releaseDeviceKeys } from "@/components/circles/circle-key";
import { forgetAllLinks } from "@/lib/local-links";

/**
 * Removes this device's circle keys and saved helper links, then ends the session. Signing in again
 * hands the keys back; nothing has to be typed. A key the server does not hold yet is handed over
 * first, and is left on the device if that cannot be confirmed (see releaseDeviceKeys).
 */
export function SignOut() {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      className="rounded-lg px-2 py-2 font-medium text-primary-700 disabled:opacity-50"
      onClick={() =>
        start(async () => {
          await releaseDeviceKeys().catch(() => undefined);
          forgetAllLinks();
          await signOut();
        })
      }
    >
      {pending ? "Signing out" : "Sign out"}
    </button>
  );
}
