import { MessageSquare, Phone } from "lucide-react";
import { CircleName, type SwitcherCircle } from "@/components/circles/CircleSwitcher";
import { WelcomeDone } from "@/components/circles/WelcomeDone";
import { telHref } from "@/lib/phone";
import { smsTo } from "@/lib/share-message";
import { circleOf, firstName, seenText } from "@/lib/what-you-see";

/** Who runs the circle, as the person looking may see it (services/members.ts, getCircleRunner). */
export type Runner = { name: string | null; phone: string | null; you: boolean };

/**
 * The first time a person opens their link: who added them, what they can see, and who to ask for
 * more. `sees` comes from lib/what-you-see.ts. `personName` is null when the circle has no name yet.
 */
export type Welcome = { circleId: string; personName: string | null; sees: string[] };

const BUTTON =
  "inline-flex min-h-11 items-center gap-2 rounded-lg border border-border-200 bg-white px-3 text-label font-semibold text-primary-700 shadow-sm hover:bg-sky-100";

/** Call and Text the person who runs the circle, when they saved a number and it is not you. */
function ContactRunner({ runner }: { runner: Runner | null }) {
  const tel = runner && !runner.you ? telHref(runner.phone) : null;
  if (!tel || !runner?.phone) return null;
  const who = runner.name || "The caregiver";
  return (
    <>
      {/* Named from what is on the button plus words for screen readers ("Call Lena Ortiz, 555-0100"), so the name always contains the visible text. */}
      <a href={tel} className={`${BUTTON} tabular-nums`}>
        <Phone className="size-4" aria-hidden="true" />
        Call<span className="sr-only"> {who},</span>
        <span className="sr-only sm:not-sr-only"> {runner.phone}</span>
      </a>
      <a href={smsTo(runner.phone, "")} className={BUTTON}>
        <MessageSquare className="size-4" aria-hidden="true" />
        Text<span className="sr-only">
          {" "}
          {who}, {runner.phone}
        </span>
      </a>
    </>
  );
}

/**
 * The top of every circle screen: whose circle this is, in large type, and who runs it, with a way to
 * call or text them. Left off printouts, which name the person themselves.
 * Until a person taps Got it, the line about who runs the circle is replaced by a welcome that says it in full.
 */
export function CircleTop({
  personName,
  runner,
  circles,
  welcome = null,
}: {
  personName: string;
  runner: Runner | null;
  circles: SwitcherCircle[];
  welcome?: Welcome | null;
}) {
  const who = runner?.name || "The caregiver";
  return (
    <div className="no-print mb-5 border-b border-border-200 pb-4" data-circle-top>
      <CircleName personName={personName} circles={circles} />
      {welcome ? (
        <WelcomeCard welcome={welcome} runner={runner} />
      ) : runner ? (
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
          <div className="flex flex-wrap gap-2 empty:hidden">
            <ContactRunner runner={runner} />
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** "Lena Ortiz added you to Teodora Ruiz's circle. You can see: the calendar and reminders. Ask Lena if you need more." */
function WelcomeCard({ welcome, runner }: { welcome: Welcome; runner: Runner | null }) {
  const circle = welcome.personName ? circleOf(welcome.personName) : "this care circle";
  const name = runner && !runner.you ? runner.name : null;
  return (
    <section aria-label="Welcome" data-welcome className="mt-3 rounded-lg border border-primary-700/20 bg-sky-100 p-4">
      <p className="text-name font-semibold text-ink-900">{name ? `${name} added you to ${circle}.` : `You were added to ${circle}.`}</p>
      <p className="mt-2 text-label text-ink-900">
        <span className="font-semibold">You can see:</span> {seenText(welcome.sees)}.
      </p>
      <p className="mt-1 text-label text-ink-500">
        {name ? `Ask ${firstName(name)} if you need more.` : "Ask the person who runs the circle if you need more."}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <ContactRunner runner={runner} />
        <WelcomeDone circleId={welcome.circleId} />
      </div>
    </section>
  );
}
