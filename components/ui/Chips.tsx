"use client";

/**
 * Tap-to-pick suggestions under a field, so fewer words need typing. Each chip is a real button
 * with a large target; the one matching `value` shows as chosen.
 */
export function Chips({
  label,
  options,
  value,
  onPick,
  className = "",
}: {
  label: string;
  options: readonly string[];
  value?: string;
  onPick: (value: string) => void;
  className?: string;
}) {
  if (!options.length) return null;
  const chosen = value?.trim().toLowerCase();
  return (
    <ul aria-label={label} className={`mt-2 flex flex-wrap gap-2 ${className}`}>
      {options.map((option) => {
        const on = chosen === option.toLowerCase();
        return (
          <li key={option}>
            <button
              type="button"
              aria-pressed={on}
              onClick={() => onPick(option)}
              className={`inline-flex min-h-10 items-center rounded-full border px-3.5 text-[14px] font-semibold transition-colors ${
                on ? "border-primary-700 bg-primary-700 text-white" : "border-border-200 bg-white text-primary-900 hover:border-primary-700/50 hover:bg-sky-100"
              }`}
            >
              {option}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
