import { clockTime, doseText, type Medication } from "@/lib/schema/medications";

export type MedDose = { id: string; name: string; dose: string; times: string[] };

const DAY_MS = 24 * 60 * 60 * 1000;
const at = (iso: string) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));

/**
 * The medicines taken on one day, from each one's schedule, with its strength and times.
 * "Only when needed" medicines are left out, as are days before a medicine started or after it
 * stopped. Repeats every few days, weeks or months count from the start date (or the last change).
 */
export function medsOnDay(meds: Medication[], date: string): MedDose[] {
  const day = at(date);
  const weekday = new Date(day).getUTCDay();
  const out: MedDose[] = [];
  for (const med of meds) {
    if (med.schedule === "as_needed") continue;
    if (med.startDate && date < med.startDate) continue;
    if (med.status === "stopped" && (!med.stopDate || date >= med.stopDate)) continue;
    const anchorIso = med.startDate ?? med.updatedAt.slice(0, 10);
    const anchor = at(anchorIso);
    const days = Math.round((day - anchor) / DAY_MS);
    const every = Math.max(1, med.every ?? 1);
    let on = false;
    switch (med.schedule) {
      case "daily":
        on = true;
        break;
      case "every_x_days":
        on = days >= 0 && days % every === 0;
        break;
      case "weekdays":
        on = med.weekdays.includes(weekday);
        break;
      case "every_x_weeks":
        on = days >= 0 && days % (7 * every) === 0;
        break;
      case "every_x_months": {
        const months = (Number(date.slice(0, 4)) - Number(anchorIso.slice(0, 4))) * 12 + (Number(date.slice(5, 7)) - Number(anchorIso.slice(5, 7)));
        on = months >= 0 && months % every === 0 && date.slice(8, 10) === anchorIso.slice(8, 10);
        break;
      }
    }
    if (on) out.push({ id: med.id, name: med.name, dose: doseText(med), times: [...med.times].sort() });
  }
  return out.sort((a, b) => (a.times[0] ?? "99").localeCompare(b.times[0] ?? "99") || a.name.localeCompare(b.name));
}

/** One line per time of day: "8 AM" with what is taken then. Medicines without a time come last. */
export function medsByTime(doses: MedDose[]): { time: string; label: string; meds: MedDose[] }[] {
  const slots = new Map<string, MedDose[]>();
  for (const dose of doses) {
    for (const time of dose.times.length ? dose.times : [""]) slots.set(time, [...(slots.get(time) ?? []), dose]);
  }
  return [...slots.entries()]
    .sort(([a], [b]) => (a || "99").localeCompare(b || "99"))
    .map(([time, meds]) => ({ time, label: time ? clockTime(time) : "Any time", meds }));
}
