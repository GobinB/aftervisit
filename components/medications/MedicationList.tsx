import { Pencil } from "lucide-react";
import Link from "next/link";
import { StatusButton } from "@/components/medications/StatusButton";
import { longDate } from "@/lib/format";
import { doseText, scheduleText, type Medication } from "@/lib/schema/medications";

/** "Blood pressure" reads as "For blood pressure"; names like "COPD" or "Parkinson's" keep their capitals. */
function forText(reason: string): string {
  return /^[A-Z][a-z]/.test(reason) && !/^[A-Z][a-z]+'s\b/.test(reason) ? reason.charAt(0).toLowerCase() + reason.slice(1) : reason;
}

/** One medication per row: name and dose, when, and why. The caregiver can edit, stop or restart. */
export function MedicationList({ medications, circleId, canEdit }: { medications: Medication[]; circleId?: string; canEdit: boolean }) {
  return (
    <ul className="divide-y divide-border-200">
      {medications.map((med) => {
        const meta = [
          med.status === "stopped" && med.stopDate ? `Stopped ${longDate(med.stopDate)}` : med.startDate ? `Since ${longDate(med.startDate)}` : null,
          med.prescriber ? `From ${med.prescriber}` : null,
          med.refillsLeft !== null ? `${med.refillsLeft} refill${med.refillsLeft === 1 ? "" : "s"} left` : null,
        ].filter(Boolean);
        return (
          <li key={med.id} className="flex flex-wrap items-start gap-x-4 gap-y-2 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className={`text-[15px] font-semibold ${med.status === "stopped" ? "text-ink-500 line-through decoration-ink-500/40" : "text-ink-900"}`}>
                {med.name}
                {doseText(med) ? <span className="ml-2 text-[14px] font-normal text-ink-500 no-underline">{doseText(med)}</span> : null}
              </p>
              <p className="mt-0.5 text-[13px] text-ink-900">{scheduleText(med)}</p>
              {med.reason ? <p className="text-[13px] text-ink-500">For {forText(med.reason)}</p> : null}
              {med.instructions ? <p className="text-[13px] text-ink-500">{med.instructions}</p> : null}
              {meta.length ? <p className="mt-1 text-[12px] text-ink-500">{meta.join(" · ")}</p> : null}
            </div>
            {canEdit && circleId ? (
              <div className="no-print flex shrink-0 items-center gap-1.5">
                <Link
                  href={`/circles/${circleId}/medications/${med.id}`}
                  className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border-200 bg-white px-2.5 text-[12px] font-medium text-ink-900 hover:bg-paper-100"
                  aria-label={`Edit ${med.name}`}
                >
                  <Pencil className="size-3.5" aria-hidden="true" /> Edit
                </Link>
                <StatusButton circleId={circleId} id={med.id} name={med.name} status={med.status} />
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
