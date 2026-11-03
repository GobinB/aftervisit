"use client";

import { Suspense } from "react";
import { Analytics as VercelAnalytics } from "@vercel/analytics/react";
import { usePathname } from "next/navigation";
import { scrubAnalyticsEvent, scrubAnalyticsUrl } from "@/lib/analytics-scrub";

/**
 * The insights script shipped with @vercel/analytics 2.0.1 sends `location.href`
 * whenever `path` equals the pathname, and sends the route separately as `dp`.
 * beforeSend only receives `url`, so the route and path passed in are already scrubbed.
 * A leftover hash (the script keeps it when it rewrites the pathname) is removed in beforeSend.
 */
function AnalyticsInner() {
  const pathname = usePathname() || "/";
  const safePath = scrubAnalyticsUrl(pathname) ?? "/";
  return (
    <VercelAnalytics
      framework="next"
      basePath={process.env.NEXT_PUBLIC_VERCEL_OBSERVABILITY_BASEPATH}
      configString={process.env.NEXT_PUBLIC_VERCEL_OBSERVABILITY_CLIENT_CONFIG}
      beforeSend={scrubAnalyticsEvent}
      path={safePath}
      route={safePath}
    />
  );
}

export function Analytics() {
  return (
    <Suspense fallback={null}>
      <AnalyticsInner />
    </Suspense>
  );
}
