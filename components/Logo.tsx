/**
 * AfterVisit mark: a check that becomes an arrow. Confirmed, then passed on.
 * "onDark" is for navy backgrounds.
 */
export const LOGO_PATHS = {
  check: "M12.5 25.5l7.5 7.5L35 17.5",
  arrow: "M26.5 16.5H35.5V25.5",
};

export function LogoMark({ size = 40, variant = "default", className = "" }: { size?: number; variant?: "default" | "onDark"; className?: string }) {
  const bg = variant === "onDark" ? "#E7EEF7" : "#1E4E8C";
  const check = variant === "onDark" ? "#1E4E8C" : "#FFFFFF";
  const arrow = variant === "onDark" ? "#2F80ED" : "#9CC9FF";
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" focusable="false" className={`shrink-0 ${className}`}>
      <rect width="48" height="48" rx="13" fill={bg} />
      <path d={LOGO_PATHS.check} fill="none" stroke={check} strokeWidth="4.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d={LOGO_PATHS.arrow} fill="none" stroke={arrow} strokeWidth="4.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Wordmark({ className = "text-[1.45rem]", tone = "default" }: { className?: string; tone?: "default" | "onDark" }) {
  return (
    <span className={`font-display leading-none font-medium ${tone === "onDark" ? "text-white" : "text-primary-900"} ${className}`}>AfterVisit</span>
  );
}

export function Logo({ size = 36, className = "" }: { size?: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark size={size} />
      <Wordmark />
    </span>
  );
}
