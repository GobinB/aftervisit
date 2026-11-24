import { Heart, Link2, UserCog } from "lucide-react";

/** Three example helpers, each with their own link and their own view. Fictional, and no one's real name. */
const HELPERS = [
  { who: "Your brother", sees: "Everything" },
  { who: "A home aide", sees: "The calendar and their own reminders" },
  { who: "A neighbor", sees: "The calendar and reminders" },
];

const NODE = "rounded-xl border border-border-200 bg-white px-4 py-3 text-center shadow-sm";
const LINE = "mx-auto block h-5 w-px bg-border-200";

/**
 * "How a circle works", drawn with text so it reads at any size and with a screen reader: one person
 * at the top, the caregiver who runs the circle, then helpers, each with their own link and view.
 * Used on the home page and the share-the-care guide. Divs and spans only, so a reading page's text
 * styles (InfoPage) do not add margins or bullets to it.
 */
export function HowACircleWorks({ title = "How a circle works" }: { title?: string }) {
  return (
    <figure aria-labelledby="circle-model-title" className="rounded-xl border border-border-200 bg-paper-100/60 p-4 sm:p-6" data-circle-model>
      <span id="circle-model-title" className="block text-tag font-semibold tracking-widest text-ink-500 uppercase">
        {title}
      </span>

      <div className="mt-4 flex flex-col items-center">
        <div className={`${NODE} w-full max-w-xs`}>
          <span className="mx-auto flex size-10 items-center justify-center rounded-full bg-heart-500/15 text-heart-500">
            <Heart className="size-5 fill-current" aria-hidden="true" />
          </span>
          <span className="mt-2 block text-name font-semibold text-ink-900">Mom</span>
          <span className="block text-hint text-ink-500">One person you look after</span>
        </div>
        <span className={LINE} aria-hidden="true" />
        <div className={`${NODE} w-full max-w-xs`}>
          <span className="mx-auto flex size-10 items-center justify-center rounded-full bg-sky-100 text-primary-700">
            <UserCog className="size-5" aria-hidden="true" />
          </span>
          <span className="mt-2 block text-name font-semibold text-ink-900">You, the caregiver</span>
          <span className="block text-hint text-ink-500">Runs the circle: adds people and chooses what each one sees</span>
        </div>
        <span className={LINE} aria-hidden="true" />
      </div>

      {/* On wider screens a bar joins the helpers to the caregiver above. */}
      <div className="relative grid gap-3 sm:grid-cols-3 sm:pt-5">
        <span className="absolute top-0 right-1/6 left-1/6 hidden h-px bg-border-200 sm:block" aria-hidden="true" />
        {HELPERS.map((helper) => (
          <div key={helper.who} className={`${NODE} relative text-left`}>
            <span className="absolute -top-5 left-1/2 hidden h-5 w-px bg-border-200 sm:block" aria-hidden="true" />
            <span className="flex items-center justify-between gap-2">
              <span className="block text-label font-semibold text-ink-900">{helper.who}</span>
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-sky-100 px-2 py-0.5 text-badge font-semibold text-primary-700">
                <Link2 className="size-3.5" aria-hidden="true" /> Own link
              </span>
            </span>
            <span className="mt-2 block border-t border-border-200 pt-2 text-hint text-ink-900">
              <span className="font-semibold">Sees:</span> {helper.sees}
            </span>
          </div>
        ))}
      </div>

      <figcaption className="mt-4 text-note text-ink-500">
        One person, one caregiver who runs the circle, and everyone who helps. Each helper opens their own link and sees only what the caregiver chose
        for them. The caregiver can change that at any time, and it works on the same link.
      </figcaption>
    </figure>
  );
}
