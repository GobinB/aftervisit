"use client";

export function Switch({
  id,
  checked,
  onChange,
  label,
  helper,
}: {
  id: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  helper?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <label htmlFor={id} className="font-medium text-ink-900">
          {label}
        </label>
        {helper ? (
          <p id={`${id}-help`} className="mt-0.5 text-sm text-ink-500">
            {helper}
          </p>
        ) : null}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-describedby={helper ? `${id}-help` : undefined}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 inline-flex h-8 w-14 shrink-0 items-center rounded-full transition-colors ${
          checked ? "bg-primary-700" : "bg-border-200"
        }`}
      >
        <span className="sr-only">{label}</span>
        <span
          className={`inline-block h-6 w-6 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-7" : "translate-x-1"}`}
        />
      </button>
    </div>
  );
}
