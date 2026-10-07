const STEPS = ["Upload", "Review", "Share", "Done"] as const;
export type Step = (typeof STEPS)[number];

/** Thin 4-step progress strip on /new routes. */
export function StepHeader({ current }: { current: Step }) {
  const idx = STEPS.indexOf(current);
  return (
    <nav aria-label="Progress" className="no-print mb-6">
      <ol className="grid grid-cols-4 gap-1.5">
        {STEPS.map((s, i) => (
          <li key={s} className="min-w-0">
            <div className={`h-1.5 rounded-full ${i <= idx ? "bg-action-500" : "bg-border-200"}`} />
            <span
              className={`mt-1.5 block truncate text-xs ${i === idx ? "font-semibold text-primary-700" : "text-ink-500"}`}
              aria-current={i === idx ? "step" : undefined}
            >
              {i < idx ? <span className="sr-only">Completed: </span> : null}
              {s}
            </span>
          </li>
        ))}
      </ol>
    </nav>
  );
}
