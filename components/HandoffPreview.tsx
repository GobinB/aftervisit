import { CalendarCheck, CheckCircle2, Eye, Pill } from "lucide-react";
import Link from "next/link";
import { Badge } from "./Badge";
import { LogoMark } from "./Logo";

/** A miniature finished handoff (the fictional sample), so people see the result before they start. */
export function HandoffPreview() {
  return (
    <figure className="relative isolate mx-auto w-full max-w-[400px]">
      <div aria-hidden="true" className="absolute -inset-6 -z-10 rounded-[40px] bg-gradient-to-br from-sky-100 via-white to-transparent" />
      <div
        role="img"
        aria-label="Example of a finished care handoff: Margaret's visit on October 3, with medication changes, tasks for Lisa, and a read receipt."
        className="overflow-hidden rounded-3xl border border-border-200 bg-white shadow-[0_24px_60px_-20px_rgb(22_58_107/0.35)]"
      >
        <div className="flex items-center gap-2 bg-primary-900 px-4 py-3 text-white">
          <LogoMark size={24} variant="onDark" />
          <span className="text-sm font-semibold">Care update</span>
        </div>
        <div className="space-y-4 p-5">
          <div>
            <p className="text-lg leading-tight font-semibold text-primary-900">Margaret&apos;s visit on Oct 3</p>
            <p className="text-sm text-ink-500">Dr. Anita Patel, Internal Medicine</p>
          </div>

          <div className="rounded-2xl border border-border-200 p-3.5">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-primary-700">
              <Pill size={16} /> What changed
            </p>
            <div className="mt-2 space-y-2 text-sm">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">Lisinopril</span>
                  <Badge tone="med">Dose changed</Badge>
                </div>
                <p className="text-ink-900/80">20 mg once daily (was 10 mg)</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium">Meclizine</span>
                <Badge tone="attn">Stopped</Badge>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border-200 p-3.5">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-primary-700">
              <CalendarCheck size={16} /> Next steps
            </p>
            <p className="mt-2 text-xs font-semibold tracking-wider text-ink-500 uppercase">For Lisa</p>
            <div className="mt-1 flex gap-2 text-sm">
              <span className="mt-1 h-3.5 w-3.5 shrink-0 rounded border-2 border-primary-700/60" />
              <span>
                Call to schedule physical therapy <span className="text-ink-500">· within 2 weeks</span>
              </span>
            </div>
          </div>

          <div className="rounded-2xl border border-border-200 border-l-4 border-l-attn p-3.5">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-primary-700">
              <Eye size={16} /> Watch for
            </p>
            <p className="mt-1.5 text-sm">Dizziness that gets worse, any fall</p>
          </div>

          <div className="flex items-center gap-2 rounded-2xl bg-ok-bg px-3.5 py-2.5 text-sm font-medium text-ok-ink">
            <CheckCircle2 size={18} /> Read by Lisa and Rosa
          </div>
        </div>
      </div>
      <figcaption className="mt-4 text-center text-sm text-ink-500">
        A finished handoff, as family and helpers see it.{" "}
        <Link href="/h/demo" className="font-medium text-primary-700 underline underline-offset-4">
          Open the full example
        </Link>
      </figcaption>
    </figure>
  );
}
