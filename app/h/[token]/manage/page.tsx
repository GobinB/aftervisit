import { CheckCircle2, Link2, MessageCircleQuestion, ShieldAlert, Users } from "lucide-react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { PageShell } from "@/components/PageShell";
import { GonePage } from "@/components/handoff/GonePage";
import { CopyField, DeleteHandoff } from "@/components/handoff/ManageActions";
import { Dashboard } from "@/components/manage/Dashboard";
import { FeedbackCard } from "@/components/Feedback";
import { lookup } from "@/lib/access";
import type { HandoffRow } from "@/lib/db";
import { eventsFor, recipientsFor, taskStatusRows, toStatusView, type EventRow, type RecipientRow } from "@/lib/invites";
import { visitTitle } from "@/lib/copy";
import { dateTime, longDate } from "@/lib/format";
import { env } from "@/lib/env";
import { ROLE_LABELS, SHARE_SECTION_LABELS, SHARE_SECTIONS } from "@/lib/schema";
import { hashManageKey, MANAGE_KEY_RE, safeEqual } from "@/lib/tokens";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Manage this handoff",
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

type Props = { params: Promise<{ token: string }>; searchParams: Promise<{ key?: string }> };

function Invalid() {
  return (
    <PageShell>
      <main id="main" className="mx-auto w-full max-w-[640px] flex-1 px-4 py-20 text-center">
        <h1 className="font-display text-2xl font-medium text-primary-900">This link is not valid</h1>
        <p className="mt-2 text-ink-500">Check that the whole manage link was copied, including the part after “key=”.</p>
        <Link href="/" className="mt-6 inline-block font-semibold text-primary-700 underline underline-offset-4">
          Go to AfterVisit
        </Link>
      </main>
    </PageShell>
  );
}

function Card({ icon, title, children, tone = "default" }: { icon: React.ReactNode; title: string; children: React.ReactNode; tone?: "default" | "danger" }) {
  return (
    <section className={`rounded-2xl border bg-white p-5 ${tone === "danger" ? "border-attn/50" : "border-border-200"}`}>
      <h2 className={`flex items-center gap-2 text-lg font-semibold ${tone === "danger" ? "text-attn-ink" : "text-primary-700"}`}>
        <span aria-hidden="true">{icon}</span>
        {title}
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

export default async function ManagePage({ params, searchParams }: Props) {
  const { token } = await params;
  const { key = "" } = await searchParams;
  if (!MANAGE_KEY_RE.test(key)) return <Invalid />;

  const found = await lookup(token, { forCreator: true });
  if (found.status !== "ok") {
    return found.status === "not_found" ? <Invalid /> : <GonePage status={found.status} />;
  }
  const row = found.row;
  if (!safeEqual(hashManageKey(key), row.manage_key_hash)) return <Invalid />;
  if (row.access_mode === "invite") return <InviteManage row={row} manageKey={key} />;

  const h = await headers();
  const origin = process.env.NEXT_PUBLIC_APP_URL ? env.appUrl : `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
  const shareUrl = `${origin}/h/${token}`;
  const feedbackUrl = process.env.NEXT_PUBLIC_FEEDBACK_URL;
  const acks = [...(row.acks ?? [])].sort((a, b) => a.at.localeCompare(b.at));

  return (
    <PageShell>
      <main id="main" className="mx-auto w-full max-w-[640px] flex-1 px-4 pt-8 pb-16">
        <h1 className="font-display text-[2.1rem] leading-tight font-medium text-primary-900">Manage this handoff</h1>
        <p className="mt-1 text-ink-500">{visitTitle(row.payload)}</p>

        <div className="mt-6 space-y-4">
          <Card icon={<CheckCircle2 size={20} />} title={`Read by (${acks.length})`}>
            <p className="mb-2 text-sm text-ink-500">Self-reported: each person typed their name on the shared link.</p>
            {acks.length ? (
              <ul className="divide-y divide-border-200/70">
                {acks.map((a, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 py-2">
                    <span className="flex items-center gap-2 font-medium">
                      <CheckCircle2 size={18} className="text-ok" aria-hidden="true" /> {a.name}
                    </span>
                    <span className="text-sm text-ink-500">{dateTime(a.at)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-ink-500">No one yet.</p>
            )}
          </Card>

          <Card icon={<Users size={20} />} title="Recipients">
            <ul className="space-y-1">
              {row.recipients.map((r, i) => (
                <li key={i}>
                  {r.name} <span className="text-ink-500">· {ROLE_LABELS[r.role]}</span>
                </li>
              ))}
            </ul>
          </Card>

          <Card icon={<Link2 size={20} />} title="Link and expiry">
            <CopyField value={shareUrl} label="Share link" />
            <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              <dt className="text-ink-500">Expires</dt>
              <dd>{longDate(row.expires_at)}</dd>
              <dt className="text-ink-500">PIN</dt>
              <dd>{row.pin_hash ? "On" : "Off"}</dd>
              <dt className="text-ink-500">Original summary</dt>
              <dd>{row.original_path ? "Attached" : "Not attached"}</dd>
            </dl>
          </Card>

          {feedbackUrl ? (
            <Card icon={<MessageCircleQuestion size={20} />} title="Two quick questions">
              <p>Did this save you calls or texts? How many?</p>
              <a href={feedbackUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block font-semibold text-primary-700 underline underline-offset-4">
                Answer in 30 seconds
              </a>
            </Card>
          ) : null}

          <Card icon={<ShieldAlert size={20} />} title="Danger zone" tone="danger">
            <p className="mb-4 text-ink-500">Deleting removes the handoff and any attached original right away.</p>
            <DeleteHandoff token={token} manageKey={key} />
          </Card>
        </div>

        <Link href="/new" className="mt-8 inline-block font-semibold text-primary-700 underline underline-offset-4">
          Create another handoff
        </Link>
      </main>
    </PageShell>
  );
}

const STATUS_TEXT: Record<string, string> = { not_started: "not started", in_progress: "in progress", completed: "completed" };

/** The dashboard for handoffs shared with personal links. */
async function InviteManage({ row, manageKey }: { row: HandoffRow; manageKey: string }) {
  const [recipients, statuses, events] = await Promise.all([recipientsFor(row.token), taskStatusRows(row.token), eventsFor(row.token)]);
  const creator = row.created_by ?? "";
  const titleOf = (id: unknown) => row.payload.tasks.find((t) => t.id === id)?.title ?? "a step";
  const sectionsLabel = (r: RecipientRow) => {
    const all = SHARE_SECTIONS.filter((s) => s !== "original" || row.original_path);
    const has = all.filter((s) => r.sections.includes(s));
    const tasks = r.sections.includes("tasks") && r.tasks_scope === "mine" ? " (only their own steps)" : "";
    return has.length === all.length ? `everything${tasks}` : has.map((s) => SHARE_SECTION_LABELS[s].toLowerCase()).join(", ") + tasks;
  };
  const eventText = (e: EventRow): string => {
    const d = e.detail as Record<string, string>;
    switch (e.kind) {
      case "invited":
        return d.reissued ? `You sent a new link to ${d.name}` : `You shared it with ${d.name}`;
      case "opened":
        return `${e.actor} opened their link`;
      case "acknowledged":
        return `${e.actor} tapped “I've read this” on their personal link`;
      case "revoked":
        return `You removed ${d.name}'s access`;
      case "task_status":
        return `${e.via === "creator" ? "You" : e.actor} marked “${titleOf(d.taskId)}” ${STATUS_TEXT[d.status] ?? d.status}${
          e.via === "personal_link" ? " (personal link)" : ""
        }${d.note ? `. Note: ${d.note}` : ""}`;
    }
  };

  return (
    <PageShell>
      <main id="main" className="mx-auto w-full max-w-[760px] flex-1 px-4 pt-8 pb-16">
        <h1 className="font-display text-[2.1rem] leading-tight font-medium text-primary-900">Manage this handoff</h1>
        <p className="mt-1 text-ink-500">
          {visitTitle(row.payload)} · expires {longDate(row.expires_at)} · PIN {row.pin_hash ? "on" : "off"}
        </p>
        <a
          href={`/h/${row.token}/manage/view?key=${manageKey}`}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-block font-semibold text-primary-700 underline underline-offset-4"
        >
          View or print the full handoff
        </a>
        <div className="mt-8">
          <Dashboard
            token={row.token}
            manageKey={manageKey}
            creator={creator}
            tasks={row.payload.tasks}
            statuses={Object.fromEntries(statuses.map((s) => [s.task_id, toStatusView(s)]))}
            recipients={recipients.map((r) => ({
              id: r.id,
              name: r.name,
              role: r.role,
              sectionsLabel: sectionsLabel(r),
              revokedAt: r.revoked_at,
              firstOpenedAt: r.first_opened_at,
              lastOpenedAt: r.last_opened_at,
              ackedAt: r.acked_at,
            }))}
            events={events.map((e) => ({ id: e.id, text: eventText(e), at: e.at, via: e.via }))}
          />
        </div>
        <div className="mt-8 space-y-4">
          <FeedbackCard context="manage" />
          <Card icon={<ShieldAlert size={20} />} title="Danger zone" tone="danger">
            <p className="mb-4 text-ink-500">Deleting removes the handoff, every personal link and any attached original right away.</p>
            <DeleteHandoff token={row.token} manageKey={manageKey} />
          </Card>
        </div>
        <Link href="/new" className="mt-8 inline-block font-semibold text-primary-700 underline underline-offset-4">
          Create another handoff
        </Link>
      </main>
    </PageShell>
  );
}
