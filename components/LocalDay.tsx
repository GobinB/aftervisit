"use client";

import { useEffect, useState } from "react";
import { shortDate } from "@/lib/format";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * "Nov 4" for a moment in time, in the viewer's own time zone. The server draws the UTC day first;
 * the browser corrects it after load, so an evening change never shows as tomorrow.
 */
export function LocalDay({ iso }: { iso: string }) {
  const [label, setLabel] = useState(() => shortDate(iso));
  useEffect(() => {
    const d = new Date(iso);
    if (!Number.isNaN(d.getTime())) setLabel(`${MONTHS[d.getMonth()]} ${d.getDate()}`);
  }, [iso]);
  return <span suppressHydrationWarning>{label}</span>;
}
