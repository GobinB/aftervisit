import Link from "next/link";
import type { Actor } from "@/lib/auth";
import { can } from "@/lib/permissions";

export type CircleTab = "overview" | "summary" | "people" | "settings";

/** One tab per module the viewer may open. A module gets a tab in the pull request that ships it. */
export function circleTabs(actor: Actor, circleId: string): { key: CircleTab; label: string; href: string }[] {
  const base = `/circles/${circleId}`;
  const tabs: { key: CircleTab; label: string; href: string }[] = [{ key: "overview", label: "Overview", href: base }];
  if (can(actor, "summary:read", { circleId })) tabs.push({ key: "summary", label: "Care summary", href: `${base}/summary` });
  if (can(actor, "members:manage", { circleId }) || can(actor, "members:read", { circleId }) || can(actor, "members:read:caregivers", { circleId })) {
    tabs.push({ key: "people", label: "People", href: `${base}/members` });
  }
  if (can(actor, "circle:delete", { circleId }) || can(actor, "circle:rotate_key", { circleId })) tabs.push({ key: "settings", label: "Settings", href: `${base}/settings` });
  return tabs;
}

export function roleLine(actor: Actor): string {
  if (actor.kind === "helper") return "Your personal link";
  return actor.role === "owner" ? "You started this circle" : "You help run this circle";
}

/** The person's name and the module tabs, above every circle screen. */
export function CircleFrame({
  personName,
  subtitle,
  tabs,
  active,
  children,
}: {
  personName: string;
  subtitle: string;
  tabs: { key: CircleTab; label: string; href: string }[];
  active: CircleTab;
  children: React.ReactNode;
}) {
  return (
    <>
      <div>
        <p className="text-eyebrow font-bold tracking-[0.14em] text-primary-700 uppercase">Care circle</p>
        <h1 className="font-display mt-2 text-heading text-primary-900 sm:text-heading-lg">{personName}</h1>
        <p className="mt-1 text-ink-500">{subtitle}</p>
      </div>
      <nav aria-label="Circle" className="no-print mt-6">
        <ul className="flex flex-wrap gap-x-6 border-b border-border-200">
          {tabs.map((tab) => (
            <li key={tab.key}>
              <Link
                href={tab.href}
                aria-current={tab.key === active ? "page" : undefined}
                className={`-mb-px inline-flex min-h-12 items-center border-b-2 font-semibold ${
                  tab.key === active ? "border-primary-700 text-primary-900" : "border-transparent text-ink-500 hover:text-ink-900"
                }`}
              >
                {tab.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <div className="mt-8">{children}</div>
    </>
  );
}
