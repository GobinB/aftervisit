"use client";
import { useSyncExternalStore } from "react";
import { dateTime } from "@/lib/format";

const noChange = () => () => {};

/**
 * "Nov 14, 6:40 AM" in the reader's own time zone. The server does not know that zone (it runs in
 * UTC), so the page drawn on the server leaves the time out and the browser fills it in as the page
 * loads. That way the server's page and the browser's first draw always match.
 */
export function LocalTime({ iso }: { iso: string }) {
  const inBrowser = useSyncExternalStore(
    noChange,
    () => true,
    () => false,
  );
  return <time dateTime={iso}>{inBrowser ? dateTime(iso) : ""}</time>;
}
