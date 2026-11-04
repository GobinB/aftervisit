import { AlertTriangle, ArrowRight, Clock3, HeartPulse, Phone, Users, Eye, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { PeopleList } from "@/components/circles/PeopleList";
import { TodayDate } from "@/components/circles/TodayDate";
import { shortDate } from "@/lib/format";
import type { CircleContent, PersonView } from "@/lib/schema/circles";
import { doseText, scheduleText, type Medication } from "@/lib/schema/medications";
import type { Alert, FeedItem, Stat, Tone } from "@/lib/today";

const STAT_ICONS: Record<string, LucideIcon> = { helpers: Users, opened: Eye, waiting: Clock3, allergies: HeartPulse };

const VALUE_TONE: Record<Tone, string> = {
  blue: "text-primary-700",
  green: "text-ok",
  amber: "text-med",
  attn: "text-attn",
  neutral: "text-ink-900",
};
const CHIP_TONE: Record<Tone, string> = {
  blue: "border-sky-100 bg-sky-100/60 text-primary-700",
  green: "border-ok-bg bg-ok-bg/60 text-ok-ink",
  amber: "border-med-bg bg-med-bg/60 text-med-ink",
  attn: "border-attn-bg bg-attn-bg/60 text-attn-ink",
  neutral: "border-border-200 bg-paper-100 text-ink-500",
};
const DOT_TONE: Record<Tone, string> = { blue: "bg-primary-700", green: "bg-ok", amber: "bg-med", attn: "bg-attn", neutral: "bg-ink-500/50" };

/** Page title row: what day it is for whom, and the caregiver's main actions. */
export function TodayHeader({ personName, actions }: { personName: string; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-[26px] leading-tight tracking-[-0.01em] text-primary-900">Today</h1>
        <p className="mt-1 text-[13px] text-ink-500">
          {personName} · <TodayDate />
        </p>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <h2 className="mb-2 text-[11px] font-semibold tracking-[0.12em] text-ink-500 uppercase">{children}</h2>;
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-lg border border-border-200 bg-white ${className}`}>{children}</div>;
}

export function StatCards({ stats }: { stats: Stat[] }) {
  return (
    <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {stats.map((stat) => {
        const Icon = STAT_ICONS[stat.key] ?? Users;
        const body = (
          <>
            <span className="flex items-start justify-between gap-2">
              <span className="text-[11px] font-semibold tracking-[0.1em] text-ink-500 uppercase">{stat.label}</span>
              <span className={`flex size-7 shrink-0 items-center justify-center rounded-md border ${CHIP_TONE[stat.tone]}`}>
                <Icon className="size-3.5" aria-hidden="true" />
              </span>
            </span>
            <span className={`mt-2 block text-[28px] leading-none font-semibold tabular-nums ${VALUE_TONE[stat.tone]}`}>{stat.value}</span>
            <span className="mt-2 block truncate text-[12px] text-ink-500">{stat.detail}</span>
          </>
        );
        return (
          <li key={stat.key}>
            {stat.href ? (
              <Link href={stat.href} className="block h-full rounded-lg border border-border-200 bg-white p-4 transition-colors hover:border-primary-700/40">
                {body}
              </Link>
            ) : (
              <div className="h-full rounded-lg border border-border-200 bg-white p-4">{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function ActivityFeed({ items, emptyHref }: { items: FeedItem[]; emptyHref: string }) {
  return (
    <Card>
      <p className="border-b border-border-200 px-4 py-2.5 text-[12px] text-ink-500">What changed, and who opened their link.</p>
      {items.length ? (
        <ul className="divide-y divide-border-200">
          {items.map((item) => (
            <li key={item.id} className="flex items-start gap-3 px-4 py-3">
              <span className={`mt-[7px] size-2 shrink-0 rounded-full ${DOT_TONE[item.tone]}`} aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-medium text-ink-900">{item.title}</span>
                <span className="block text-[12px] text-ink-500">{item.detail}</span>
              </span>
              <time dateTime={item.at} className="shrink-0 text-[12px] text-ink-500 tabular-nums">
                {shortDate(item.at)}
              </time>
            </li>
          ))}
        </ul>
      ) : (
        <div className="px-4 py-8 text-center">
          <p className="text-[14px] font-medium text-ink-900">Nothing here yet</p>
          <Link href={emptyHref} className="mt-2 inline-flex items-center gap-1 text-[13px] font-semibold text-primary-700 hover:text-primary-900">
            Add the first person who helps <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
        </div>
      )}
    </Card>
  );
}

export function Alerts({ alerts }: { alerts: Alert[] }) {
  return (
    <Card className="space-y-2 p-3">
      {alerts.length ? (
        alerts.map((alert) => (
          <Link key={alert.key} href={alert.href} className={`flex items-center gap-2.5 rounded-md border px-3 py-2.5 text-[13px] font-medium ${CHIP_TONE[alert.tone]}`}>
            <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
            <span className="flex-1">{alert.label}</span>
            <span className="font-semibold tabular-nums">{alert.count}</span>
          </Link>
        ))
      ) : (
        <p className="px-1 py-1.5 text-[13px] text-ink-500">Nothing needs you right now.</p>
      )}
    </Card>
  );
}

/** Allergies and who to call, for a quick look. The full page has the rest. */
export function AtAGlance({ content, href }: { content: CircleContent; href: string | null }) {
  const contacts = content.emergency_contacts.slice(0, 2);
  return (
    <Card className="p-4">
      <p className="text-[11px] font-semibold tracking-[0.1em] text-ink-500 uppercase">Allergies</p>
      {content.allergies.length ? (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {content.allergies.map((allergy) => (
            <li key={allergy} className="rounded-md bg-attn-bg px-2 py-0.5 text-[13px] font-medium text-attn-ink">
              {allergy}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-[13px] text-ink-500">None recorded</p>
      )}
      <p className="mt-4 text-[11px] font-semibold tracking-[0.1em] text-ink-500 uppercase">Who to call</p>
      {contacts.length ? (
        <ul className="mt-1 divide-y divide-border-200">
          {contacts.map((contact) => (
            <li key={`${contact.name}-${contact.phone}`} className="flex items-center justify-between gap-3 py-2">
              <span className="min-w-0">
                <span className="block truncate text-[14px] font-medium text-ink-900">{contact.name}</span>
                {contact.relationship ? <span className="block text-[12px] text-ink-500">{contact.relationship}</span> : null}
              </span>
              {contact.phone ? (
                <a
                  href={`tel:${contact.phone.replace(/[^\d+]/g, "")}`}
                  className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-md border border-border-200 px-2.5 text-[13px] font-medium text-primary-700 hover:bg-sky-100"
                >
                  <Phone className="size-3.5" aria-hidden="true" /> {contact.phone}
                </a>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-[13px] text-ink-500">No emergency contact yet</p>
      )}
      {href ? (
        <Link href={href} className="mt-3 inline-flex items-center gap-1 text-[13px] font-semibold text-primary-700 hover:text-primary-900">
          Full care summary <ArrowRight className="size-3.5" aria-hidden="true" />
        </Link>
      ) : null}
    </Card>
  );
}

export function PeopleCard({ people, showSeen, href, linkLabel }: { people: PersonView[]; showSeen: boolean; href: string; linkLabel: string }) {
  return (
    <Card className="px-4 py-1">
      <PeopleList people={people} showSeen={showSeen} />
      <Link href={href} className="mb-2 inline-flex items-center gap-1 py-1 text-[13px] font-semibold text-primary-700 hover:text-primary-900">
        {linkLabel} <ArrowRight className="size-3.5" aria-hidden="true" />
      </Link>
    </Card>
  );
}

/** What the person takes now, in short. The Medications page has the rest. */
export function MedsGlance({ medications, href }: { medications: Medication[]; href: string }) {
  const active = medications.filter((med) => med.status === "active");
  return (
    <Card>
      {active.length ? (
        <ul className="divide-y divide-border-200">
          {active.slice(0, 6).map((med) => (
            <li key={med.id} className="px-4 py-2.5">
              <span className="block text-[14px] font-medium text-ink-900">
                {med.name}
                {doseText(med) ? <span className="ml-1.5 font-normal text-ink-500">{doseText(med)}</span> : null}
              </span>
              <span className="block text-[12px] text-ink-500">{scheduleText(med)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-4 py-3 text-[13px] text-ink-500">No medications listed yet.</p>
      )}
      <Link href={href} className="flex items-center gap-1 border-t border-border-200 px-4 py-2.5 text-[13px] font-semibold text-primary-700 hover:text-primary-900">
        {active.length > 6 ? `All ${active.length} medications` : "All medications"} <ArrowRight className="size-3.5" aria-hidden="true" />
      </Link>
    </Card>
  );
}
