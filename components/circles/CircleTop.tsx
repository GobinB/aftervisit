import { MessageSquare, Phone } from "lucide-react";
import { CircleName, type SwitcherCircle } from "@/components/circles/CircleSwitcher";
import { telHref } from "@/lib/phone";
import { smsTo } from "@/lib/share-message";

/** Who runs the circle, as the person looking may see it (services/members.ts, getCircleRunner). */
export type Runner = { name: string | null; phone: string | null; you: boolean };

const BUTTON =
  "inline-flex min-h-11 items-center gap-2 rounded-lg border border-border-200 bg-white px-3 text-label font-semibold text-primary-700 shadow-sm hover:bg-sky-100";

/**
 * The top of every circle screen: whose circle this is, in large type, and who runs it, with a way to
 * call or text them. Left off printouts, which name the person themselves.
 */
export function CircleTop({ personName, runner, circles }: { personName: string; runner: Runner | null; circles: SwitcherCircle[] }) {
  const tel = runner && !runner.you ? telHref(runner.phone) : null;
  const who = runner?.name || "The caregiver";
  return (
    <div className="no-print mb-5 border-b border-border-200 pb-4" data-circle-top>
      <CircleName personName={personName} circles={circles} />
      {runner ? (
        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-2">
          <p className="text-label text-ink-500">
            {runner.you ? (
              "You run this circle"
            ) : (
              <>
                <span className="font-semibold text-ink-900">{who}</span> runs this circle
              </>
            )}
          </p>
          {tel && runner.phone ? (
            <div className="flex flex-wrap gap-2">
              <a href={tel} className={`${BUTTON} tabular-nums`} aria-label={`Call ${who}, ${runner.phone}`}>
                <Phone className="size-4" aria-hidden="true" />
                Call<span className="max-sm:hidden"> {runner.phone}</span>
              </a>
              <a href={smsTo(runner.phone, "")} className={BUTTON} aria-label={`Text ${who}, ${runner.phone}`}>
                <MessageSquare className="size-4" aria-hidden="true" />
                Text
              </a>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
