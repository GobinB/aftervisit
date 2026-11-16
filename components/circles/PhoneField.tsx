"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { setMemberPhoneAction, setOwnPhoneAction } from "@/app/actions/members";
import { cleanPhone } from "@/lib/phone";

/**
 * One phone number and a Save button. Without `memberId` it is the viewer's own number: the
 * caregiver's, or a person's from their own link. Leaving it blank and saving removes the number.
 */
export function PhoneField({
  circleId,
  memberId,
  initial,
  label,
  help,
}: {
  circleId: string;
  memberId?: string;
  initial: string | null;
  label: string;
  help?: string;
}) {
  const router = useRouter();
  const id = useId();
  const [value, setValue] = useState(initial ?? "");
  const [saved, setSaved] = useState(initial ?? "");
  const [note, setNote] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const changed = value.trim() !== saved.trim();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNote(null);
    const checked = cleanPhone(value);
    if (!checked.ok) {
      setProblem(checked.error);
      return;
    }
    setProblem(null);
    start(async () => {
      const result = memberId ? await setMemberPhoneAction({ circleId, memberId, phone: value }) : await setOwnPhoneAction({ circleId, phone: value });
      if (!result.ok) {
        setProblem(result.error);
        return;
      }
      setValue(result.phone ?? "");
      setSaved(result.phone ?? "");
      setNote(result.phone ? "Number saved." : "Number removed.");
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} noValidate className="no-print">
      <label htmlFor={id} className="text-[15px] font-semibold text-ink-900">
        {label} <span className="font-normal text-ink-500">(optional)</span>
      </label>
      <div className="mt-1.5 flex flex-col gap-2 sm:flex-row">
        <input
          id={id}
          type="tel"
          inputMode="tel"
          autoComplete={memberId ? "off" : "tel"}
          maxLength={30}
          value={value}
          placeholder="e.g. 555-010-0142"
          aria-describedby={help ? `${id}-help` : undefined}
          aria-invalid={problem ? true : undefined}
          onChange={(event) => {
            setValue(event.target.value);
            setNote(null);
          }}
          className="min-h-12 w-full rounded-xl border border-border-200 bg-white px-3 text-[16px] text-ink-900 tabular-nums outline-none focus:border-action-500 sm:max-w-64"
        />
        <button
          type="submit"
          disabled={pending || !changed}
          className="inline-flex min-h-12 items-center justify-center rounded-xl border border-primary-700 bg-white px-4 text-[15px] font-semibold text-primary-700 hover:bg-sky-100 disabled:opacity-50"
        >
          {pending ? "Saving" : saved && !value.trim() ? "Remove number" : "Save number"}
        </button>
      </div>
      {help ? (
        <p id={`${id}-help`} className="mt-1 text-[13px] text-ink-500">
          {help}
        </p>
      ) : null}
      {problem ? (
        <p role="alert" className="mt-2 rounded-xl bg-attn-bg px-3 py-2 text-[14px] text-attn-ink">
          {problem}
        </p>
      ) : null}
      <p aria-live="polite" className={note ? "mt-2 text-[14px] font-medium text-ok-ink" : "sr-only"}>
        {note ?? ""}
      </p>
    </form>
  );
}
