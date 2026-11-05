/* eslint-disable @next/next/no-img-element -- small static SVGs; next/image adds nothing here */
/**
 * All Hands Care logo: two cupped navy hands holding a coral heart ("Cupped Support").
 * The designer's outlined SVGs live in public/brand: the symbol, and the wordmark with its lettering
 * converted to paths. "onDark" is the white version for the navy sidebar and dark headers.
 */
export const BRAND = {
  symbol: { default: "/brand/symbol.svg", onDark: "/brand/symbol-on-dark.svg" },
  wordmark: { default: "/brand/wordmark.svg", onDark: "/brand/wordmark-on-dark.svg" },
} as const;

/** The symbol's width over its height, from its viewBox (326 by 230). */
export const SYMBOL_RATIO = 326 / 230;
/** The wordmark's width over its height, from its viewBox (854 by 127). */
const WORDMARK_RATIO = 854 / 127;

/** The symbol alone, `size` pixels tall. Decorative: the name is always next to it or on the link. */
export function LogoMark({ size = 40, variant = "default", className = "" }: { size?: number; variant?: "default" | "onDark"; className?: string }) {
  return (
    <img
      src={BRAND.symbol[variant]}
      width={Math.round(size * SYMBOL_RATIO)}
      height={size}
      alt=""
      aria-hidden="true"
      className={`shrink-0 ${className}`}
    />
  );
}

/**
 * The wordmark, sized by the font size of `className` so existing text sizes still apply.
 * It is an image of the name, so its alt text is the name.
 */
export function Wordmark({ className = "text-[1.15rem] sm:text-[1.45rem]", tone = "default" }: { className?: string; tone?: "default" | "onDark" }) {
  return (
    <span className={`inline-flex items-center leading-none ${className}`}>
      <img
        src={BRAND.wordmark[tone]}
        alt="All Hands Care"
        width={Math.round(18 * WORDMARK_RATIO)}
        height={18}
        className="h-[0.8em] w-auto"
      />
    </span>
  );
}

export function Logo({ size = 32, className = "" }: { size?: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark size={size} />
      {/* The smallest phones show the mark alone; the link around it carries the name. */}
      <Wordmark className="text-[1.15rem] max-[359px]:hidden sm:text-[1.45rem]" />
    </span>
  );
}
