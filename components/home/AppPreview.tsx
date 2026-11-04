import { CircleFrame, type CircleTab } from "@/components/circles/CircleFrame";
import { Panel } from "@/components/circles/Panel";
import { PeopleList } from "@/components/circles/PeopleList";
import { SummaryView } from "@/components/circles/SummaryView";
import { LogoMark } from "@/components/Logo";
import { SAMPLE_CIRCLE, SAMPLE_PEOPLE } from "@/lib/sample-circle";

const TABS: { key: CircleTab; label: string; href: string }[] = [
  { key: "overview", label: "Overview", href: "#" },
  { key: "summary", label: "Care summary", href: "#" },
  { key: "people", label: "People", href: "#" },
];

type Screen = "overview" | "people" | "summary";

const CAPTIONS: Record<Screen, string> = {
  overview: "A fictional circle for Margaret Lee: her allergies and the people who help, with when each last opened their link.",
  people: "A fictional circle for Margaret Lee: four people who help, each with a role and when they last opened their link.",
  summary: "A fictional care summary for Margaret Lee: allergies, doctors, pharmacy and emergency contacts.",
};

/**
 * A screen from the app, drawn by the app's own components with fictional data.
 * It is a picture: nothing inside can be focused or clicked, and the caption describes it.
 */
export function AppPreview({ screen, className = "" }: { screen: Screen; className?: string }) {
  return (
    <figure className={className}>
      <div className="overflow-hidden rounded-2xl border border-border-200 bg-white">
        <div className="flex items-center justify-between gap-3 border-b border-border-200 bg-surface-50 px-4 py-2.5">
          <span className="flex items-center gap-2 text-sm font-semibold text-ink-900">
            <LogoMark size={22} /> All Hands Care
          </span>
          <span className="rounded border border-attn/50 px-1.5 text-tag font-bold tracking-wider text-attn-ink uppercase">Fictional</span>
        </div>
        <div inert aria-hidden="true" className="px-5 pt-6 pb-7 sm:px-7">
          <CircleFrame personName={SAMPLE_CIRCLE.person_name} subtitle="You started this circle" tabs={TABS} active={screen}>
            {screen === "overview" ? (
              <div className="space-y-8">
                <Panel title="People" href="#" linkLabel="Add or manage people">
                  <PeopleList people={SAMPLE_PEOPLE.slice(0, 3)} showSeen />
                </Panel>
                <Panel title="Care summary" href="#" linkLabel="See the full summary">
                  <SummaryView content={{ ...SAMPLE_CIRCLE, doctors: [], emergency_contacts: SAMPLE_CIRCLE.emergency_contacts.slice(0, 1) }} compact />
                </Panel>
              </div>
            ) : screen === "people" ? (
              <PeopleList people={SAMPLE_PEOPLE} showSeen />
            ) : (
              <SummaryView content={SAMPLE_CIRCLE} compact />
            )}
          </CircleFrame>
        </div>
      </div>
      <figcaption className="sr-only">{CAPTIONS[screen]}</figcaption>
    </figure>
  );
}
