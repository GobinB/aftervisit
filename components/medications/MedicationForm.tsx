"use client";

import { Plus, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState, useTransition } from "react";
import { saveMedicationAction } from "@/app/actions/medications";
import { Chips } from "@/components/ui/Chips";
import { Suggest } from "@/components/ui/Suggest";
import { AMOUNTS, HOW_OFTEN, INSTRUCTIONS, REASONS, STRENGTHS, howOftenKey } from "@/lib/suggestions";
import { MED_FORMS, MED_FORM_LABELS, MED_SCHEDULES, MED_SCHEDULE_LABELS, WEEKDAY_SHORT, type Medication, type MedSchedule } from "@/lib/schema/medications";

// 16 px text on phones, so iPhones do not zoom in when a field is tapped.
const field = "mt-1 block h-12 w-full rounded-lg border border-border-200 bg-white px-3 text-[16px] text-ink-900 focus:border-primary-700 sm:h-11 sm:text-[15px]";
const label = "block text-[15px] font-semibold text-ink-900";
const UNIT: Partial<Record<MedSchedule, string>> = { every_x_days: "days", every_x_weeks: "weeks", every_x_months: "months" };

/** Add or edit one medication. Only the name is required. */
export function MedicationForm({ circleId, medication, doctors = [] }: { circleId: string; medication?: Medication; doctors?: string[] }) {
  const id = useId();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(medication?.name ?? "");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [dose, setDose] = useState(medication?.dose ?? "");
  const [amount, setAmount] = useState(medication?.amount ?? "");
  const [form, setForm] = useState<string>(medication?.form ?? "");
  const [schedule, setSchedule] = useState<MedSchedule>(medication?.schedule ?? "daily");
  const [every, setEvery] = useState(String(medication?.every ?? 2));
  const [weekdays, setWeekdays] = useState<number[]>(medication?.weekdays ?? []);
  const [times, setTimes] = useState<string[]>(medication?.times.length ? medication.times : medication ? [] : ["08:00"]);
  const [startDate, setStartDate] = useState(medication?.startDate ?? "");
  const [reason, setReason] = useState(medication?.reason ?? "");
  const [instructions, setInstructions] = useState(medication?.instructions ?? "");
  const [prescriber, setPrescriber] = useState(medication?.prescriber ?? "");
  const [refillsLeft, setRefillsLeft] = useState(medication?.refillsLeft?.toString() ?? "");
  const [lastRefill, setLastRefill] = useState(medication?.lastRefill ?? "");

  // Name suggestions come from this site, which filters the public RxNorm list. Typing never leaves it.
  useEffect(() => {
    const query = name.trim();
    if (query.length < 2) {
      setSuggestions([]);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      fetch("/api/drug-names", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ q: query }), signal: controller.signal })
        .then((response) => (response.ok ? response.json() : { names: [] }))
        .then((body: { names?: string[] }) => setSuggestions(body.names ?? []))
        .catch(() => undefined);
    }, 200);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [name]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    start(async () => {
      const result = await saveMedicationAction({
        circleId,
        ...(medication ? { id: medication.id } : {}),
        name,
        dose,
        amount,
        form,
        schedule,
        ...(UNIT[schedule] ? { every: Number(every) || undefined } : {}),
        weekdays: schedule === "weekdays" ? weekdays : [],
        times: schedule === "as_needed" ? [] : times.filter(Boolean),
        startDate,
        reason,
        instructions,
        prescriber,
        ...(refillsLeft !== "" ? { refillsLeft: Number(refillsLeft) } : {}),
        lastRefill,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(`/circles/${circleId}/medications`);
      router.refresh();
    });
  };

  return (
    <form onSubmit={submit} className="max-w-2xl space-y-5 rounded-lg border border-border-200 bg-white p-4 sm:p-5" noValidate>
      <div>
        <label htmlFor={`${id}-name`} className={label}>
          Name
        </label>
        <Suggest
          id={`${id}-name`}
          className={field}
          value={name}
          onChange={setName}
          suggestions={suggestions}
          label="Medication names"
          maxLength={120}
          placeholder="Start typing, e.g. lisinopril"
          emptyHint="No match in the list. That's fine: keep the name as you typed it."
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor={`${id}-dose`} className={label}>
            Strength
          </label>
          <input id={`${id}-dose`} className={field} value={dose} onChange={(event) => setDose(event.target.value)} maxLength={80} placeholder="e.g. 10 mg" />
          <Chips label="Common strengths" options={STRENGTHS} value={dose} onPick={setDose} />
        </div>
        <div>
          <label htmlFor={`${id}-amount`} className={label}>
            How much
          </label>
          <input id={`${id}-amount`} className={field} value={amount} onChange={(event) => setAmount(event.target.value)} maxLength={80} placeholder="e.g. 1 tablet" />
          <Chips label="Common amounts" options={AMOUNTS} value={amount} onPick={setAmount} />
        </div>
        <div>
          <label htmlFor={`${id}-form`} className={label}>
            Form
          </label>
          <select id={`${id}-form`} className={field} value={form} onChange={(event) => setForm(event.target.value)}>
            <option value="">Choose</option>
            {MED_FORMS.map((value) => (
              <option key={value} value={value}>
                {MED_FORM_LABELS[value]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <fieldset className="space-y-3">
        <legend className={label}>How often</legend>
        <ul aria-label="Common schedules" className="flex flex-wrap gap-2">
          {HOW_OFTEN.map((item) => {
            const on = howOftenKey(schedule, times) === item.key;
            return (
              <li key={item.key}>
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => {
                    setSchedule(item.schedule);
                    setTimes(item.times);
                  }}
                  className={`inline-flex min-h-11 items-center rounded-full border px-4 text-[15px] font-semibold ${
                    on ? "border-primary-700 bg-primary-700 text-white" : "border-border-200 bg-white text-primary-900 hover:bg-sky-100"
                  }`}
                >
                  {item.label}
                </button>
              </li>
            );
          })}
        </ul>
        <p className="text-[13px] text-ink-500">Or set it yourself:</p>
        <select aria-label="How often" className={field} value={schedule} onChange={(event) => setSchedule(event.target.value as MedSchedule)}>
          {MED_SCHEDULES.map((value) => (
            <option key={value} value={value}>
              {MED_SCHEDULE_LABELS[value]}
            </option>
          ))}
        </select>
        {UNIT[schedule] ? (
          <label className="flex items-center gap-2 text-[14px] text-ink-900">
            Every
            <input type="number" min={1} max={365} className="h-10 w-20 rounded-md border border-border-200 px-2" value={every} onChange={(event) => setEvery(event.target.value)} />
            {UNIT[schedule]}
          </label>
        ) : null}
        {schedule === "weekdays" ? (
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Days of the week">
            {WEEKDAY_SHORT.map((day, index) => {
              const on = weekdays.includes(index);
              return (
                <button
                  key={day}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setWeekdays(on ? weekdays.filter((value) => value !== index) : [...weekdays, index])}
                  className={`h-9 min-w-12 rounded-md border px-2 text-[13px] font-medium ${on ? "border-primary-700 bg-primary-700 text-white" : "border-border-200 bg-white text-ink-900"}`}
                >
                  {day}
                </button>
              );
            })}
          </div>
        ) : null}
        {schedule !== "as_needed" ? (
          <div className="space-y-2">
            {times.map((time, index) => (
              <div key={index} className="flex items-center gap-2">
                <input
                  type="time"
                  aria-label={`Time ${index + 1}`}
                  className="h-10 rounded-md border border-border-200 px-3 text-[14px]"
                  value={time}
                  onChange={(event) => setTimes(times.map((value, i) => (i === index ? event.target.value : value)))}
                />
                <button
                  type="button"
                  aria-label={`Remove time ${index + 1}`}
                  onClick={() => setTimes(times.filter((_, i) => i !== index))}
                  className="inline-flex size-9 items-center justify-center rounded-md text-ink-500 hover:bg-paper-100"
                >
                  <X className="size-4" aria-hidden="true" />
                </button>
              </div>
            ))}
            {times.length < 8 ? (
              <button type="button" onClick={() => setTimes([...times, ""])} className="inline-flex items-center gap-1 text-[13px] font-semibold text-primary-700">
                <Plus className="size-4" aria-hidden="true" /> Add a time
              </button>
            ) : null}
          </div>
        ) : null}
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={`${id}-reason`} className={label}>
            What it is for
          </label>
          <input id={`${id}-reason`} className={field} value={reason} onChange={(event) => setReason(event.target.value)} maxLength={200} placeholder="e.g. Blood pressure" />
          <Chips label="Common reasons" options={REASONS} value={reason} onPick={setReason} />
        </div>
        <div>
          <label htmlFor={`${id}-instructions`} className={label}>
            How to take it
          </label>
          <input
            id={`${id}-instructions`}
            className={field}
            value={instructions}
            onChange={(event) => setInstructions(event.target.value)}
            maxLength={500}
            placeholder="e.g. With food"
          />
          <Chips label="Common instructions" options={INSTRUCTIONS} value={instructions} onPick={setInstructions} />
        </div>
      </div>

      <details className="group rounded-md border border-border-200 px-3 py-2" open={Boolean(medication && (medication.prescriber || medication.refillsLeft !== null || medication.startDate || medication.lastRefill))}>
        <summary className="cursor-pointer text-[13px] font-medium text-ink-900">More details</summary>
        <div className="mt-3 grid gap-4 pb-2 sm:grid-cols-2">
          <div>
            <label htmlFor={`${id}-start`} className={label}>
              Started
            </label>
            <input id={`${id}-start`} type="date" className={field} value={startDate} onChange={(event) => setStartDate(event.target.value)} />
          </div>
          <div>
            <label htmlFor={`${id}-prescriber`} className={label}>
              Prescribed by
            </label>
            <input id={`${id}-prescriber`} className={field} value={prescriber} onChange={(event) => setPrescriber(event.target.value)} maxLength={120} placeholder="e.g. Dr. Patel" />
            <Chips label="Their doctors" options={doctors} value={prescriber} onPick={setPrescriber} />
          </div>
          <div>
            <label htmlFor={`${id}-refills`} className={label}>
              Refills left
            </label>
            <input id={`${id}-refills`} type="number" min={0} max={99} className={field} value={refillsLeft} onChange={(event) => setRefillsLeft(event.target.value)} />
          </div>
          <div>
            <label htmlFor={`${id}-refill`} className={label}>
              Last refill
            </label>
            <input id={`${id}-refill`} type="date" className={field} value={lastRefill} onChange={(event) => setLastRefill(event.target.value)} />
          </div>
        </div>
      </details>

      {error ? (
        <p role="alert" className="rounded-md bg-attn-bg px-3 py-2 text-[13px] text-attn-ink">
          {error}
        </p>
      ) : null}
      <div className="flex items-center gap-2">
        <button type="submit" disabled={pending} className="inline-flex h-12 items-center rounded-lg bg-primary-700 px-5 text-[16px] font-semibold text-white hover:bg-primary-900 disabled:opacity-50">
          {pending ? "Saving" : "Save medication"}
        </button>
        <Link href={`/circles/${circleId}/medications`} className="inline-flex h-10 items-center rounded-md px-3 text-[14px] font-medium text-ink-500 hover:text-ink-900">
          Cancel
        </Link>
      </div>
    </form>
  );
}
