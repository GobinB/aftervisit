import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type Variant = "primary" | "secondary" | "soft" | "light" | "ghost" | "danger" | "navy" | "pill";

const base =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 select-none";
const variants: Record<Variant, string> = {
  primary: "min-h-12 rounded-xl px-5 text-base bg-primary-700 text-white hover:bg-primary-900 disabled:hover:bg-primary-700",
  secondary: "min-h-12 rounded-xl px-5 text-base border-2 border-primary-700 bg-white text-primary-700 hover:bg-sky-100",
  soft: "min-h-12 rounded-xl px-5 text-base bg-white text-ink-900 ring-1 ring-ink-900/15 hover:ring-ink-900/30 hover:bg-white",
  light: "min-h-12 rounded-xl px-5 text-base bg-white text-primary-900 hover:bg-sky-100",
  ghost: "min-h-10 rounded-xl px-3 text-base text-primary-700 hover:bg-sky-100",
  danger: "min-h-12 rounded-xl px-5 text-base border-2 border-attn bg-white text-attn-ink hover:bg-attn-bg",
  navy: "min-h-12 rounded-xl px-5 text-base bg-white/10 text-white ring-1 ring-white/30 hover:bg-white/20",
  pill: "min-h-10 rounded-full px-4 text-[0.95rem] bg-ink-900 text-white hover:bg-primary-900",
};

export function buttonClass(variant: Variant = "primary", extra = "") {
  return `${base} ${variants[variant]} ${extra}`;
}

export function Button({ variant = "primary", className = "", ...props }: ComponentProps<"button"> & { variant?: Variant }) {
  return <button type="button" className={buttonClass(variant, className)} {...props} />;
}

export function ButtonLink({
  href,
  variant = "primary",
  className = "",
  children,
  ...rest
}: { href: string; variant?: Variant; className?: string; children: ReactNode } & Omit<ComponentProps<typeof Link>, "href" | "className">) {
  return (
    <Link href={href} className={buttonClass(variant, className)} {...rest}>
      {children}
    </Link>
  );
}
