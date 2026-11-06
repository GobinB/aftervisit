import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Help } from "@/components/circles/Help";

/** A large, plain way back, at the top of every sub-page and form, on every screen size. */
export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="no-print mb-3 inline-flex min-h-11 items-center gap-2 rounded-lg border border-border-200 bg-white pr-4 pl-3 text-[15px] font-semibold text-primary-700 shadow-sm hover:bg-sky-100"
    >
      <ArrowLeft className="size-5" strokeWidth={2.25} aria-hidden="true" />
      {label}
    </Link>
  );
}

/**
 * The top of a circle page: an optional way back, the title with its (i) help, a short line under it,
 * and the page's main actions.
 */
export function PageHead({
  back,
  title,
  subtitle,
  help,
  actions,
}: {
  back?: { href: string; label: string };
  title: ReactNode;
  subtitle?: ReactNode;
  help?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-5">
      {back ? <BackLink href={back.href} label={back.label} /> : null}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-[26px] leading-tight tracking-[-0.01em] text-primary-900">{title}</h1>
            {help ? <Help text={help} /> : null}
          </div>
          {subtitle ? <p className="mt-1 text-[13px] text-ink-500">{subtitle}</p> : null}
        </div>
        {actions ? <div className="no-print flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}
