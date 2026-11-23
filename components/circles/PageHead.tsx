import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Help } from "@/components/circles/Help";

/** A large, plain way back, at the top of every sub-page and form, on every screen size. */
export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="no-print mb-3 inline-flex min-h-11 items-center gap-2 rounded-lg border border-border-200 bg-white pr-4 pl-3 text-label font-semibold text-primary-700 shadow-sm hover:bg-sky-100"
    >
      <ArrowLeft className="size-5" strokeWidth={2.25} aria-hidden="true" />
      {label}
    </Link>
  );
}

/**
 * The person's name in a page's subtitle, on printouts only. On screen it is already large at the top of
 * every circle page (CircleTop), which is left off paper. `alone` drops the separator after it.
 */
export function PrintedName({ name, alone = false }: { name: string; alone?: boolean }) {
  return <span className="hidden print:inline">{alone ? name : `${name} · `}</span>;
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
    <div className="mb-4 sm:mb-5">
      {back ? <BackLink href={back.href} label={back.label} /> : null}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {/* Inside a circle the person's name above is the largest line (CircleTop), so the page title stays a size down. */}
            <h1 className="font-display text-section tracking-[-0.01em] text-primary-900 sm:text-page sm:group-data-circle/shell:text-section">{title}</h1>
            {help ? <Help text={help} /> : null}
          </div>
          {subtitle ? <p className="mt-1 text-hint text-ink-500">{subtitle}</p> : null}
        </div>
        {actions ? <div className="no-print flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}
