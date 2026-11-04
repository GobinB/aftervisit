/**
 * All Hands Care mark (interim, until the designed logo lands): four arcs around a dot.
 * Everyone around one person. "onDark" is for navy backgrounds.
 * The same shapes draw the favicon, the app icons and the share image.
 */
export const LOGO_ARCS = [
  "M36.43 27.8A13 13 0 0 1 27.8 36.43",
  "M20.2 36.43A13 13 0 0 1 11.57 27.8",
  "M11.57 20.2A13 13 0 0 1 20.2 11.57",
  "M27.8 11.57A13 13 0 0 1 36.43 20.2",
];
export const LOGO_DOT = { cx: 24, cy: 24, r: 4.8 };
export const LOGO_COLORS = { tile: "#1E4E8C", arcs: "#FFFFFF", dot: "#FDBA74" };

export function LogoMark({ size = 40, variant = "default", className = "" }: { size?: number; variant?: "default" | "onDark"; className?: string }) {
  const tile = variant === "onDark" ? "#E7EEF7" : LOGO_COLORS.tile;
  const arcs = variant === "onDark" ? "#1E4E8C" : LOGO_COLORS.arcs;
  const dot = variant === "onDark" ? "#C2410C" : LOGO_COLORS.dot;
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" focusable="false" className={`shrink-0 ${className}`}>
      <rect width="48" height="48" rx="13" fill={tile} />
      {LOGO_ARCS.map((d) => (
        <path key={d} d={d} fill="none" stroke={arcs} strokeWidth="4.6" strokeLinecap="round" />
      ))}
      <circle {...LOGO_DOT} fill={dot} />
    </svg>
  );
}

/** The arcs and dot without the tile, for icons drawn with ImageResponse. */
export function MarkGlyph({ size, arcs = LOGO_COLORS.arcs, dot = LOGO_COLORS.dot }: { size: number; arcs?: string; dot?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48">
      {LOGO_ARCS.map((d) => (
        <path key={d} d={d} fill="none" stroke={arcs} strokeWidth="4.6" strokeLinecap="round" />
      ))}
      <circle cx={LOGO_DOT.cx} cy={LOGO_DOT.cy} r={LOGO_DOT.r} fill={dot} />
    </svg>
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
