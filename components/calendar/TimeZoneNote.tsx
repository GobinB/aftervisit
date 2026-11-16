"use client";

import { useEffect, useState } from "react";
import { setTimeZoneAction } from "@/app/actions/circles";

/** "Eastern Time" for "America/New_York"; the zone's own name if the browser has no long name for it. */
function zoneName(timeZone: string): string {
  try {
    const part = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "longGeneric" }).formatToParts(new Date()).find((p) => p.type === "timeZoneName");
    return part?.value ?? timeZone;
  } catch {
    return timeZone;
  }
}

/**
 * Says which time zone the calendar link uses, so a 7:00 medicine shows at 7:00 where the person
 * lives. If this device is in a different zone, offers to switch to it (for a caregiver who set the
 * circle up while away from home); it is never switched without a tap.
 */
export function TimeZoneNote({ circleId, timeZone }: { circleId: string; timeZone: string | null }) {
  const [saved, setSaved] = useState(timeZone);
  const [device, setDevice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  useEffect(() => {
    try {
      setDevice(Intl.DateTimeFormat().resolvedOptions().timeZone ?? null);
    } catch {}
  }, []);

  async function use(zone: string) {
    setPending(true);
    setProblem(null);
    try {
      const result = await setTimeZoneAction({ circleId, timeZone: zone, replace: true });
      if (result.ok) setSaved(result.timeZone);
      else setProblem(result.error);
    } catch {
      setProblem("That did not save. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  const zone = saved ?? device;
  if (!zone) return null;
  return (
    <div className="mt-6 max-w-2xl rounded-lg border border-border-200 bg-white p-4 text-[15px] text-ink-900">
      <p>
        Times are in <strong>{zoneName(zone)}</strong> ({zone}), where the person lives. A medicine at 7:00 shows at 7:00 there.
      </p>
      {device && saved && device !== saved ? (
        <p className="mt-2 text-ink-500">
          This phone or computer is set to {zoneName(device)}.{" "}
          <button
            type="button"
            disabled={pending}
            onClick={() => use(device)}
            className="font-semibold text-primary-700 underline-offset-4 hover:underline disabled:opacity-50"
          >
            {pending ? "Saving" : `Use ${zoneName(device)} instead`}
          </button>
        </p>
      ) : null}
      {problem ? (
        <p role="alert" className="mt-2 text-[14px] text-attn-ink">
          {problem}
        </p>
      ) : null}
    </div>
  );
}
