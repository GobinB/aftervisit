"use client";

import { useEffect } from "react";
import { setTimeZoneAction } from "@/app/actions/circles";

/**
 * For a circle started before time zones were kept: records this device's zone once, in the
 * background. The server keeps a zone already set, so this never moves medicine times.
 */
export function RecordTimeZone({ circleId }: { circleId: string }) {
  useEffect(() => {
    let zone: string | undefined;
    try {
      zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {}
    if (zone) void setTimeZoneAction({ circleId, timeZone: zone }).catch(() => undefined);
  }, [circleId]);
  return null;
}
