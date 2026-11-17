const STEPS = ["Upload", "Review", "Share", "Done"] as const;
export type Step = (typeof STEPS)[number];

/** A visit going into a circle has three steps; the Done screen is the end of Update. */
const CIRCLE_STEPS = ["Upload", "Review", "Update"] as const;

/** Thin progress strip on /new routes. A visit started from a circle updates it instead of sharing. */
export function StepHeader({ current, circle = false }: { current: Step; circle?: boolean }) {
  const steps: readonly string[] = circle ? CIRCLE_STEPS : STEPS;
  // In a circle, Share is Update, and Done fills the whole strip with Update still named.
  const idx = circle ? Math.min(STEPS.indexOf(current), CIRCLE_STEPS.length - 1) : STEPS.indexOf(current);
  return (
    <nav aria-label="Progress" className="no-print mb-5">
      <ol className={`grid gap-1.5 ${steps.length === 3 ? "grid-cols-3" : "grid-cols-4"}`}>
        {steps.map((s, i) => (
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
