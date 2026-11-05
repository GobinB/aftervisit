/**
 * All Hands Care logo: three hands around a coral heart, by the designer (November 2026).
 * The symbol files live in public/brand. The wordmark is DM Serif Display, the same face the
 * designer outlined, set as live text so it stays sharp and readable by screen readers.
 * "onDark" is the white and coral symbol for the navy sidebar and dark headers.
 */
export const SYMBOL_SRC = { default: "/brand/symbol.svg", onDark: "/brand/symbol-on-dark.svg" } as const;

export function LogoMark({ size = 40, variant = "default", className = "" }: { size?: number; variant?: "default" | "onDark"; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- a small static SVG; next/image adds nothing here
    <img src={SYMBOL_SRC[variant]} width={size} height={size} alt="" aria-hidden="true" className={`shrink-0 ${className}`} />
  );
}

export function Wordmark({ className = "text-[1.15rem] sm:text-[1.45rem]", tone = "default" }: { className?: string; tone?: "default" | "onDark" }) {
  return (
    <span className={`font-display leading-none font-medium whitespace-nowrap ${tone === "onDark" ? "text-white" : "text-primary-900"} ${className}`}>All Hands Care</span>
  );
}

export function Logo({ size = 36, className = "" }: { size?: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark size={size} />
      {/* The smallest phones show the mark alone; the link around it carries the name. */}
      <Wordmark className="text-[1.15rem] max-[359px]:hidden sm:text-[1.45rem]" />
    </span>
  );
}
