import Link from "next/link";
import { PageHead } from "@/components/circles/PageHead";
import type { Actor } from "@/lib/auth";
import { can } from "@/lib/permissions";

export type CircleTab = "overview" | "calendar" | "todos" | "medications" | "summary" | "people" | "settings";

/** One tab per module the viewer may open. A module gets a tab in the pull request that ships it. */
export function circleTabs(actor: Actor, circleId: string): { key: CircleTab; label: string; href: string }[] {
  const base = `/circles/${circleId}`;
  const tabs: { key: CircleTab; label: string; href: string }[] = [{ key: "overview", label: "Today", href: base }];
  if (can(actor, "calendar:read", { circleId })) tabs.push({ key: "calendar", label: "Calendar", href: `${base}/calendar` });
  if (can(actor, "tasks:read", { circleId }) || (actor.kind === "helper" && can(actor, "tasks:read:own", { circleId, assigneeId: actor.memberId }))) {
    tabs.push({ key: "todos", label: "Reminders", href: `${base}/todos` });
  }
  if (can(actor, "medications:read", { circleId })) tabs.push({ key: "medications", label: "Medications", href: `${base}/medications` });
  if (can(actor, "summary:read", { circleId })) tabs.push({ key: "summary", label: "Care summary", href: `${base}/summary` });
  if (can(actor, "members:manage", { circleId }) || can(actor, "members:read", { circleId }) || can(actor, "members:read:caregivers", { circleId })) {
    tabs.push({ key: "people", label: "People", href: `${base}/members` });
  }
  if (can(actor, "circle:delete", { circleId })) tabs.push({ key: "settings", label: "Settings", href: `${base}/settings` });
  return tabs;
}

export function roleLine(actor: Actor): string {
  if (actor.kind === "helper") return "Your personal link";
  return "You run this circle";
}

/**
 * The person's name and the module tabs, above every circle screen.
 * Inside CircleShell the sidebar (wide screens) or the bottom bar (phones) holds the tabs, so they show only elsewhere, like the home page preview.
 */
export function CircleFrame({
  personName,
  subtitle,
  tabs,
  active,
  help,
  children,
}: {
  personName: string;
  subtitle: string;
  tabs: { key: CircleTab; label: string; href: string }[];
  active: CircleTab;
  help?: string;
  children: React.ReactNode;
}) {
  const title = tabs.find((tab) => tab.key === active)?.label ?? personName;
  return (
    <>
      <PageHead title={title} subtitle={`${personName} · ${subtitle}`} help={help} />
      <nav aria-label="Circle" className="no-print -mt-1 mb-5 group-data-[shell=sidebar]/shell:hidden">
        <ul className="flex gap-x-5 overflow-x-auto border-b border-border-200 [scrollbar-width:none]">
          {tabs.map((tab) => (
            <li key={tab.key} className="shrink-0">
              <Link
                href={tab.href}
                aria-current={tab.key === active ? "page" : undefined}
                className={`-mb-px inline-flex min-h-11 items-center border-b-2 text-[14px] font-semibold ${
                  tab.key === active ? "border-primary-700 text-primary-900" : "border-transparent text-ink-500 hover:text-ink-900"
                }`}
              >
                {tab.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <div>{children}</div>
    </>
  );
}
