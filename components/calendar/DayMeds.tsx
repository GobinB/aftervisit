import { Pill } from "lucide-react";
import { medsByTime, type MedDose } from "@/lib/med-days";

/** One day's medicines, by time of day, with names and strengths. */
export function DayMeds({ doses, empty = "No scheduled medicines this day." }: { doses: MedDose[]; empty?: string }) {
  const slots = medsByTime(doses);
  if (!slots.length) return <p className="px-4 py-4 text-[14px] text-ink-500">{empty}</p>;
  return (
    <ul className="divide-y divide-border-200">
      {slots.map((slot) => (
        <li key={slot.time || "any"} className="flex items-start gap-3 px-4 py-3">
          <span className="w-20 shrink-0 pt-0.5 text-[13px] font-semibold text-ink-500 tabular-nums">{slot.label}</span>
          <ul className="min-w-0 flex-1 space-y-1">
            {slot.meds.map((med) => (
              <li key={med.id} className="flex items-start gap-2 text-[15px] text-ink-900">
                <Pill className="mt-1 size-4 shrink-0 text-primary-700" aria-hidden="true" />
                <span>
                  <span className="font-semibold">{med.name}</span>
                  {med.dose ? <span className="text-ink-500"> · {med.dose}</span> : null}
                </span>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}
