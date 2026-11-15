import { ArrowRight, Eye, HelpCircle, Lightbulb, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { visitLabel, type VisitView } from "@/lib/schema/visits";

type NoteList = { key: string; title: string; icon: LucideIcon; tone: string; lines: string[] };

/** The lists a viewer may see, leaving out the empty ones. Questions are absent for home aides and day programs. */
export function noteLists(visit: VisitView): NoteList[] {
  return [
    { key: "watch", title: "Watch for", icon: Eye, tone: "text-attn-ink", lines: visit.watchFor },
    { key: "know", title: "Good to know", icon: Lightbulb, tone: "text-primary-700", lines: visit.goodToKnow },
    { key: "ask", title: "Questions for the next visit", icon: HelpCircle, tone: "text-primary-700", lines: visit.questions ?? [] },
  ].filter((list) => list.lines.length > 0);
}

/** Watch for, good to know and questions, side by side on a wide screen and stacked on a phone. */
export function VisitNoteLists({ visit, columns = false }: { visit: VisitView; columns?: boolean }) {
  const lists = noteLists(visit);
  if (!lists.length) return null;
  return (
    <div className={columns ? "grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3" : "space-y-5"}>
      {lists.map((list) => (
        <section key={list.key} aria-label={list.title}>
          <h3 className={`flex items-center gap-1.5 text-[12px] font-bold tracking-[0.08em] uppercase ${list.tone}`}>
            <list.icon className="size-4" aria-hidden="true" /> {list.title}
          </h3>
          <ul className={`mt-1.5 space-y-1 text-ink-900 ${columns ? "text-[14px]" : "text-[16px]"}`}>
            {list.lines.map((line, i) => (
              <li key={`${i}-${line}`} className="flex gap-2">
                <span className="mt-[9px] size-1.5 shrink-0 rounded-full bg-ink-500/50" aria-hidden="true" />
                <span className="min-w-0 break-words">{line}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

/**
 * Today: what the newest visit said that is not a medicine, a reminder or an appointment. The
 * viewer gets only what their role allows; the summary and the questions are simply not in `visit`
 * for a home aide or a day program.
 */
export function LastVisitCard({ visit, circleId, more }: { visit: VisitView; circleId: string; more: number }) {
  const base = `/circles/${circleId}/visits`;
  return (
    <div className="rounded-lg border border-border-200 bg-white">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-border-200 px-4 py-2.5">
        <p className="text-[14px] font-semibold text-ink-900">{visitLabel(visit)}</p>
        <Link href={`${base}/notes/${visit.id}`} className="inline-flex items-center gap-1 text-[13px] font-semibold text-primary-700 hover:text-primary-900">
          Open this visit <ArrowRight className="size-3.5" aria-hidden="true" />
        </Link>
      </div>
      <div className="space-y-3 px-4 py-3">
        {visit.summary ? <p className="text-[14px] text-ink-900">{visit.summary}</p> : null}
        <VisitNoteLists visit={visit} columns />
      </div>
      <Link href={base} className="flex items-center gap-1 border-t border-border-200 px-4 py-2.5 text-[13px] font-semibold text-primary-700 hover:text-primary-900">
        {more > 0 ? `All visits (${more + 1})` : "All visits"} <ArrowRight className="size-3.5" aria-hidden="true" />
      </Link>
    </div>
  );
}
