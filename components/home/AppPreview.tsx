import { CircleFrame, type CircleTab } from "@/components/circles/CircleFrame";
import { Panel } from "@/components/circles/Panel";
import { PeopleList } from "@/components/circles/PeopleList";
import { SummaryView } from "@/components/circles/SummaryView";
import { Agenda } from "@/components/calendar/Agenda";
import { MedicationList } from "@/components/medications/MedicationList";
import { TodoList } from "@/components/todos/TodoList";
import { LogoMark, Wordmark } from "@/components/Logo";
import { SAMPLE_CALENDAR, SAMPLE_CIRCLE, SAMPLE_MEDICATIONS, SAMPLE_PEOPLE, SAMPLE_TODOS } from "@/lib/sample-circle";

const TABS: { key: CircleTab; label: string; href: string }[] = [
  { key: "overview", label: "Today", href: "#" },
  { key: "calendar", label: "Calendar", href: "#" },
  { key: "todos", label: "To-dos", href: "#" },
  { key: "medications", label: "Medications", href: "#" },
  { key: "summary", label: "Care summary", href: "#" },
  { key: "people", label: "People", href: "#" },
];

type Screen = "overview" | "calendar" | "todos" | "medications" | "people" | "summary";

const CAPTIONS: Record<Screen, string> = {
  overview: "A fictional circle for Margaret Lee: her allergies and the people who help, with when each last opened their link.",
  calendar: "A fictional calendar for Margaret Lee: physical therapy, a cardiology visit that needs someone to go, a prescription to pick up and a birthday dinner.",
  todos: "A fictional to-do list for Margaret Lee: four to-dos, who has each one, when it is due, and one that needs a volunteer.",
  medications: "A fictional medication list for Margaret Lee: four medications with strength, when each is taken and what it is for.",
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
            <LogoMark size={20} /> <Wordmark className="text-[15px]" />
          </span>
          <span className="rounded border border-attn/50 px-1.5 text-tag font-bold tracking-wider text-attn-ink uppercase">Fictional</span>
        </div>
        <div inert aria-hidden="true" className="px-5 pt-6 pb-7 sm:px-7">
          <CircleFrame personName={SAMPLE_CIRCLE.person_name} subtitle="You run this circle" tabs={TABS} active={screen}>
            {screen === "overview" ? (
              <div className="space-y-8">
                <Panel title="People" href="#" linkLabel="Add or manage people">
                  <PeopleList people={SAMPLE_PEOPLE.slice(0, 3)} showSeen />
                </Panel>
                <Panel title="Care summary" href="#" linkLabel="See the full summary">
                  <SummaryView content={{ ...SAMPLE_CIRCLE, doctors: [], emergency_contacts: SAMPLE_CIRCLE.emergency_contacts.slice(0, 1) }} compact />
                </Panel>
              </div>
            ) : screen === "calendar" ? (
              <div className="-mx-4 overflow-hidden rounded-lg border border-border-200">
                <Agenda items={SAMPLE_CALENDAR} circleId="sample" canEdit={false} empty="" fromToday={false} />
              </div>
            ) : screen === "todos" ? (
              <div className="-mx-4 rounded-lg border border-border-200">
                <TodoList todos={SAMPLE_TODOS} canEdit={false} />
              </div>
            ) : screen === "medications" ? (
              <div className="-mx-4 rounded-lg border border-border-200">
                <MedicationList medications={SAMPLE_MEDICATIONS} canEdit={false} />
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
