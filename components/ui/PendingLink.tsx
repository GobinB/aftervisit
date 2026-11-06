"use client";

import { Loader2 } from "lucide-react";
import Link, { useLinkStatus } from "next/link";
import type { ComponentProps, ReactNode } from "react";

function Spinner({ children }: { children: ReactNode }) {
  const { pending } = useLinkStatus();
  return (
    <>
      {children}
      {pending ? <Loader2 className="size-4 shrink-0 animate-spin" aria-label="Loading" /> : null}
    </>
  );
}

/**
 * A link that shows a small spinner the moment it is tapped, for pages that have to come from the
 * server (another month, another day). Without it a tap on a slow phone connection looks ignored.
 */
export function PendingLink({ children, ...props }: ComponentProps<typeof Link>) {
  return (
    <Link {...props}>
      <Spinner>{children}</Spinner>
    </Link>
  );
}
