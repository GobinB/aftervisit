import { CheckCircle2 } from "lucide-react";
import { SamplePrintout } from "./SamplePrintout";

/**
 * The transformation in one picture: the clinic's dense printout (marked up with a
 * highlighter, the way caregivers do) behind the clear, confirmed cards AfterVisit makes.
 * Content is the fictional sample visit.
 */
export function HeroArtifact() {
  return (
    <div
      role="img"
      aria-label="A fictional after-visit summary printout with highlighted instructions, and in front of it three clear cards: a medication change, a task for Lisa, and a warning sign, with a note that Rosa has read it."
      className="relative mx-auto h-[440px] w-full max-w-[540px] sm:h-[500px]"
    >
      {/* The printout (fictional sample) */}
      <div aria-hidden="true" className="absolute top-0 left-0 w-[84%] -rotate-[2.5deg]" style={{ height: "94%" }}>
        <SamplePrintout className="h-full" fade />
      </div>

      {/* The handoff */}
      <ul aria-hidden="true" className="absolute top-[24%] -right-1 w-[60%] space-y-3 sm:top-[22%] sm:-right-4 sm:w-[58%]">
        <Card tag="Medication" tagClass="bg-med-bg text-med-ink" meta="Oct 3 · Dr. Patel" className="translate-x-0">
          <span className="font-semibold">Lisinopril</span> is now 20 mg once a day, in the morning. It was 10 mg.
        </Card>
        <Card tag="For Lisa" tagClass="bg-sky-100 text-primary-900" meta="Within 2 weeks" className="-translate-x-3 sm:-translate-x-8">
          Call to schedule physical therapy for balance.
        </Card>
        <Card tag="Watch for" tagClass="bg-attn-bg text-attn-ink" meta="Call the clinic" className="translate-x-2">
          Dizziness that gets worse, or any fall.
        </Card>
        <li className="ml-auto flex w-fit -translate-x-4 items-center gap-2 rounded-full bg-white px-3.5 py-2 text-[13px] font-medium text-ok-ink shadow-[0_10px_24px_-14px_rgb(28_36_51/0.5)] ring-1 ring-black/5">
          <CheckCircle2 size={16} className="text-ok" /> Rosa read this at 9:14 AM
        </li>
      </ul>
    </div>
  );
}

function Card({ tag, tagClass, meta, className, children }: { tag: string; tagClass: string; meta: string; className?: string; children: React.ReactNode }) {
  return (
    <li className={`rounded-xl bg-white px-4 py-3 shadow-[0_14px_30px_-16px_rgb(28_36_51/0.45)] ring-1 ring-black/5 ${className ?? ""}`}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
        <span className={`rounded-full px-2 py-0.5 font-bold tracking-wider uppercase ${tagClass}`}>{tag}</span>
        <span className="text-ink-500">{meta}</span>
      </div>
      <p className="mt-1.5 text-[13px] leading-snug text-ink-900 sm:text-[15px]">{children}</p>
    </li>
  );
}
