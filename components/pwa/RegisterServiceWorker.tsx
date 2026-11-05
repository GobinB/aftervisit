"use client";

import { useEffect } from "react";

/** Registers the service worker in production builds. Development keeps the network only. */
export function RegisterServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      // The site works the same without it; only the offline page is lost.
    });
  }, []);
  return null;
}
