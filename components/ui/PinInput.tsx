"use client";
import { useRef } from "react";

/** Four large digit boxes with auto-advance and a numeric keyboard on mobile. */
export function PinInput({
  value,
  onChange,
  onComplete,
  label,
  autoFocus,
  disabled,
  invalid,
}: {
  value: string;
  onChange: (v: string) => void;
  onComplete?: (v: string) => void;
  label: string;
  autoFocus?: boolean;
  disabled?: boolean;
  invalid?: boolean;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length: 4 }, (_, i) => value[i] ?? "");

  const setAt = (i: number, d: string) => {
    const next = digits.slice();
    next[i] = d;
    const v = next.join("").slice(0, 4);
    onChange(v);
    if (v.length === 4 && /^\d{4}$/.test(v)) onComplete?.(v);
  };

  return (
    <fieldset className="flex justify-center gap-3" disabled={disabled}>
      <legend className="sr-only">{label}</legend>
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          value={d}
          autoFocus={autoFocus && i === 0}
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          maxLength={1}
          aria-label={`${label}, digit ${i + 1} of 4`}
          aria-invalid={invalid || undefined}
          className={`h-16 w-14 rounded-xl border-2 bg-white text-center text-2xl font-semibold text-ink-900 outline-none focus:border-action-500 ${
            invalid ? "border-attn" : "border-border-200"
          }`}
          onChange={(e) => {
            const only = e.target.value.replace(/\D/g, "");
            if (only.length > 1) {
              // Pasted or autofilled several digits.
              const v = (digits.slice(0, i).join("") + only).slice(0, 4);
              onChange(v);
              refs.current[Math.min(v.length, 3)]?.focus();
              if (v.length === 4) onComplete?.(v);
              return;
            }
            setAt(i, only);
            if (only && i < 3) refs.current[i + 1]?.focus();
          }}
          onKeyDown={(e) => {
            if (e.key === "Backspace" && !digits[i] && i > 0) {
              e.preventDefault();
              setAt(i - 1, "");
              refs.current[i - 1]?.focus();
            } else if (e.key === "ArrowLeft" && i > 0) refs.current[i - 1]?.focus();
            else if (e.key === "ArrowRight" && i < 3) refs.current[i + 1]?.focus();
          }}
          onFocus={(e) => e.target.select()}
        />
      ))}
    </fieldset>
  );
}
