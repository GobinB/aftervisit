"use client";

import { useEffect, useId, useState } from "react";
import { setTimeZoneAction } from "@/app/actions/circles";

/** The US zones a family is most likely in, with plain names. Anything else the browser knows still works. */
const COMMON_ZONES: { zone: string; label: string }[] = [
  { zone: "America/New_York", label: "Eastern Time" },
  { zone: "America/Chicago", label: "Central Time" },
  { zone: "America/Denver", label: "Mountain Time" },
  { zone: "America/Phoenix", label: "Arizona (no daylight saving)" },
  { zone: "America/Los_Angeles", label: "Pacific Time" },
  { zone: "America/Anchorage", label: "Alaska" },
  { zone: "Pacific/Honolulu", label: "Hawaii" },
];

/** "Eastern Time" for "America/New_York"; the zone's own name if the browser has no long name for it. */
function zoneName(timeZone: string): string {
  const common = COMMON_ZONES.find((item) => item.zone === timeZone);
  if (common) return common.label;
  try {
    const part = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "longGeneric" }).formatToParts(new Date()).find((p) => p.type === "timeZoneName");
    return part?.value ?? timeZone;
  } catch {
    return timeZone;
  }
}

/**
 * Where the person lives, as a time zone, so a 7:00 medicine shows at 7:00 there in the calendar link
 * and "today" is their today. It starts as the zone of the device the circle was set up on; a
 * caregiver who lives somewhere else (a son in Chicago looking after his mother in Louisville) picks
 * hers here. It is never changed without a tap.
 */
export function TimeZoneNote({ circleId, timeZone, personName }: { circleId: string; timeZone: string | null; personName: string }) {
  const selectId = useId();
  const [saved, setSaved] = useState(timeZone);
  const [device, setDevice] = useState<string | null>(null);
  const [choice, setChoice] = useState<string>(timeZone ?? "");
  const [pending, setPending] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  useEffect(() => {
    try {
      const zone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? null;
      setDevice(zone);
      if (!timeZone && zone) setChoice(zone);
    } catch {}
  }, [timeZone]);

  async function save() {
    if (!choice) return;
    setPending(true);
    setProblem(null);
    setNote(null);
    try {
      const result = await setTimeZoneAction({ circleId, timeZone: choice, replace: true });
      if (result.ok) {
        setSaved(result.timeZone);
        setNote(`Saved: ${zoneName(result.timeZone)}.`);
      } else setProblem(result.error);
    } catch {
      setProblem("That did not save. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  // The list: the common US zones, plus the saved zone and this device's zone if they are not among them.
  const options = [...COMMON_ZONES];
  for (const zone of [saved, device]) {
    if (zone && !options.some((item) => item.zone === zone)) options.push({ zone, label: zoneName(zone) });
  }
  const current = saved ?? device;

  return (
    <div className="mt-6 max-w-2xl rounded-lg border border-border-200 bg-white p-4 text-[15px] text-ink-900">
      {current ? (
        <p>
          Times are in <strong>{zoneName(current)}</strong>, where {personName} lives. A medicine at 7:00 shows at 7:00 there, wherever you are.
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <div className="min-w-56 flex-1">
          <label htmlFor={selectId} className="text-[14px] font-semibold text-ink-900">
            {personName} lives in
          </label>
          <select
            id={selectId}
            value={choice}
            onChange={(event) => setChoice(event.target.value)}
            className="mt-1 min-h-12 w-full rounded-lg border border-border-200 bg-white px-3 text-base text-ink-900 outline-none focus:border-action-500"
          >
            {!choice ? <option value="">Choose a time zone</option> : null}
            {options.map((item) => (
              <option key={item.zone} value={item.zone}>
                {item.label}
                {item.zone === device && device !== saved ? " (this phone or computer)" : ""}
              </option>
            ))}
          </select>
        </div>
        {choice && choice !== saved ? (
          <button
            type="button"
            disabled={pending}
            onClick={save}
            className="inline-flex min-h-12 items-center rounded-lg bg-primary-700 px-5 text-[15px] font-semibold text-white hover:bg-primary-900 disabled:opacity-50"
          >
            {pending ? "Saving" : "Save"}
          </button>
        ) : null}
      </div>
      {problem ? (
        <p role="alert" className="mt-2 text-[14px] text-attn-ink">
          {problem}
        </p>
      ) : null}
      {note ? (
        <p role="status" className="mt-2 text-[14px] text-ok-ink">
          {note}
        </p>
      ) : null}
    </div>
  );
}
