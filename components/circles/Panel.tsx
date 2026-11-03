import { ArrowRight } from "lucide-react";
import Link from "next/link";

/** A titled part of the circle overview, with an optional link to its module. */
export function Panel({ title, href, linkLabel, children }: { title: string; href?: string | null; linkLabel?: string; children: React.ReactNode }) {
  const id = `${title.replace(/\s+/g, "-").toLowerCase()}-title`;
  return (
    <section aria-labelledby={id}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b-2 border-ink-900 pb-3">
        <h2 id={id} className="font-display text-section text-ink-900">
          {title}
        </h2>
        {href && linkLabel ? (
          <Link href={href} className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-primary-700 hover:text-primary-900">
            {linkLabel} <ArrowRight size={16} aria-hidden="true" />
          </Link>
        ) : null}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}
