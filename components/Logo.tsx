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

/**
 * The full logo as one lockup, `size` pixels tall. The name is drawn at about half the symbol's
 * height, a fixed gap from it, and set a little low so it lines up with the hands, not the heart,
 * the way the designer's artwork pairs them. On the smallest phones only the symbol shows.
 */
export function Logo({ size = 38, variant = "default", className = "" }: { size?: number; variant?: "default" | "onDark"; className?: string }) {
  const word = Math.round(size * 0.5);
  return (
    <span className={`inline-flex items-center ${className}`} style={{ gap: Math.round(size * 0.3) }}>
      <LogoMark size={size} variant={variant} />
      <img
        src={BRAND.wordmark[variant]}
        alt="All Hands Care"
        width={Math.round(word * WORDMARK_RATIO)}
        height={word}
        className="block shrink-0 max-[359px]:hidden"
        style={{ height: word, width: "auto", transform: `translateY(${Math.round(size * 0.07)}px)` }}
      />
    </span>
  );
}
