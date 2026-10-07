"use client";
import { AlertTriangle, CalendarClock, Check, CheckCircle2, CircleDashed, Copy, History, ListChecks, Plus, UserX, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Attribution, StatusChip, TaskStatusControl } from "@/components/handoff/TaskStatus";
import { RoleChips } from "@/components/RoleChips";
import { COPY } from "@/lib/copy";
import { dateTime, longDate } from "@/lib/format";
import { ROLE_LABELS, type Role, type Task, type TaskStatusValue, type TaskStatusView } from "@/lib/schema";

export interface DashRecipient {
  id: string;
  name: string;
  role: Role;
  sectionsLabel: string;
  revokedAt: string | null;
  firstOpenedAt: string | null;
  lastOpenedAt: string | null;
  ackedAt: string | null;
}

export interface DashEvent {
  id: number;
  text: string;
  at: string;
  via: "personal_link" | "creator" | "shared_link";
}

const today = () => new Date().toISOString().slice(0, 10);
const inDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

async function call(url: string, manageKey: string, body: unknown) {
  try {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", "x-manage-key": manageKey }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    return res.ok ? { ok: true as const, data } : { ok: false as const, message: data.message || COPY.genericError };
  } catch {
    return { ok: false as const, message: COPY.offline };
  }
}

function Tile({ icon: Icon, label, value, tone = "default" }: { icon: typeof Users; label: string; value: string; tone?: "default" | "warn" | "ok" }) {
  const color = tone === "warn" ? "text-med-ink" : tone === "ok" ? "text-ok-ink" : "text-ink-900";
  return (
    <div className="rounded-2xl border border-border-200 bg-white p-4">
      <p className="flex items-center gap-2 text-sm text-ink-500">
        <Icon size={16} aria-hidden="true" /> {label}
      </p>
      <p className={`font-display mt-1 text-[1.7rem] leading-tight ${color}`}>{value}</p>
    </div>
  );
}

function CopyBox({ url, label }: { url: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-2 rounded-xl bg-sky-100 p-3">
      <p className="text-sm font-medium text-primary-900">{label}</p>
      <div className="mt-1.5 flex gap-2">
        <input readOnly value={url} aria-label={label} onFocus={(e) => e.target.select()} className="h-11 min-w-0 flex-1 rounded-lg border border-border-200 bg-white px-3 text-sm" />
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard.writeText(url).catch(() => {});
            setCopied(true);
          }}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-white px-3 text-sm font-semibold text-primary-700 ring-1 ring-border-200"
        >
          {copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />} {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <p className="mt-1 text-xs text-ink-500">Shown only once. Send it to them now.</p>
    </div>
  );
}

/** "Your care handoff at a glance": who has it, who has read it, and what is still outstanding. */
export function Dashboard({
  token,
  manageKey,
  creator,
  tasks,
  statuses,
  recipients,
  events,
}: {
  token: string;
  manageKey: string;
  creator: string;
  tasks: Task[];
  statuses: Record<string, TaskStatusView>;
  recipients: DashRecipient[];
  events: DashEvent[];
}) {
  const router = useRouter();
  const [state, setState] = useState(statuses);
  const [newLinks, setNewLinks] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const active = recipients.filter((r) => !r.revokedAt);
  const read = active.filter((r) => r.ackedAt);
  const completed = tasks.filter((t) => state[t.id]?.status === "completed");
  const inProgress = tasks.filter((t) => state[t.id]?.status === "in_progress");
  const open = tasks.filter((t) => state[t.id]?.status !== "completed");
  const overdue = open.filter((t) => t.dueDate && t.dueDate < today());
  const soon = open.filter((t) => t.dueDate && t.dueDate >= today() && t.dueDate <= inDays(7));
  const nameFor = (id?: string | null) => recipients.find((r) => r.id === id)?.name;

  async function recipientAction(r: DashRecipient, action: "revoke" | "new_link") {
    if (action === "revoke" && !window.confirm(`Remove ${r.name}'s access? Their link stops working right away. Everyone else keeps access.`)) return;
    setBusy(`${action}-${r.id}`);
    setError(null);
    const res = await call(`/api/handoffs/${token}/recipients/${r.id}`, manageKey, { action });
    setBusy(null);
    if (!res.ok) return setError(res.message);
    if (action === "new_link") setNewLinks((m) => ({ ...m, [r.id]: res.data.url }));
    router.refresh();
  }

  return (
    <div className="space-y-8">
      <section aria-labelledby="glance-title">
        <h2 id="glance-title" className="font-display text-[1.6rem] text-ink-900">
          Your care handoff at a glance
        </h2>
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Tile icon={Users} label="Have read it" value={`${read.length} of ${active.length}`} tone={read.length === active.length && active.length ? "ok" : "default"} />
          <Tile icon={ListChecks} label="Steps completed" value={`${completed.length} of ${tasks.length}`} tone={tasks.length && completed.length === tasks.length ? "ok" : "default"} />
          <Tile icon={CircleDashed} label="In progress" value={String(inProgress.length)} />
          <Tile
            icon={overdue.length ? AlertTriangle : CalendarClock}
            label={overdue.length ? "Overdue" : "Due in 7 days"}
            value={String(overdue.length || soon.length)}
            tone={overdue.length ? "warn" : "default"}
          />
        </div>
        {active.length > read.length ? (
          <p className="mt-3 text-[0.95rem] text-ink-500">
            Not read yet:{" "}
            <strong className="text-ink-900">
              {active
                .filter((r) => !r.ackedAt)
                .map((r) => r.name)
                .join(", ")}
            </strong>
          </p>
        ) : null}
      </section>

      {error ? (
        <p role="alert" className="rounded-xl bg-attn-bg px-4 py-3 text-attn-ink">
          {error}
        </p>
      ) : null}

      <section aria-labelledby="people-title" className="rounded-2xl border border-border-200 bg-white p-5">
        <h2 id="people-title" className="flex items-center gap-2 text-lg font-semibold text-primary-700">
          <Users size={20} aria-hidden="true" /> People
        </h2>
        <p className="mt-1 text-sm text-ink-500">
          Each person has their own link. &ldquo;Read&rdquo; means they tapped &ldquo;I&apos;ve read this&rdquo; on their personal link; it shows which link
          was used, not who was holding the phone.
        </p>
        <ul className="mt-3 divide-y divide-border-200">
          {recipients.map((r) => (
            <li key={r.id} className="py-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">
                    {r.name} <span className="font-normal text-ink-500">· {ROLE_LABELS[r.role]}</span>
                  </p>
                  <p className="text-sm text-ink-500">Sees: {r.sectionsLabel}</p>
                </div>
                {r.revokedAt ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-attn-bg px-2.5 py-0.5 text-xs font-semibold text-attn-ink">
                    <UserX size={13} aria-hidden="true" /> Access removed
                  </span>
                ) : r.ackedAt ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-ok-bg px-2.5 py-0.5 text-xs font-semibold text-ok-ink">
                    <CheckCircle2 size={13} aria-hidden="true" /> Read {dateTime(r.ackedAt)}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-50 px-2.5 py-0.5 text-xs font-semibold text-ink-500 ring-1 ring-border-200">
                    Not read yet
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-ink-500">
                {r.firstOpenedAt ? `Opened ${dateTime(r.firstOpenedAt)}${r.lastOpenedAt && r.lastOpenedAt !== r.firstOpenedAt ? `, last ${dateTime(r.lastOpenedAt)}` : ""}` : "Not opened yet"}
              </p>
              {newLinks[r.id] ? <CopyBox url={newLinks[r.id]} label={`New link for ${r.name}`} /> : null}
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => recipientAction(r, "new_link")}
                  className="min-h-10 rounded-lg px-3 text-sm font-semibold text-primary-700 ring-1 ring-border-200 hover:bg-sky-100 disabled:opacity-60"
                >
                  {busy === `new_link-${r.id}` ? "Creating…" : r.revokedAt ? "Restore with a new link" : "Get a new link"}
                </button>
                {!r.revokedAt ? (
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => recipientAction(r, "revoke")}
                    className="min-h-10 rounded-lg px-3 text-sm font-semibold text-attn-ink ring-1 ring-attn/40 hover:bg-attn-bg disabled:opacity-60"
                  >
                    {busy === `revoke-${r.id}` ? "Removing…" : "Remove access"}
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
        <AddPerson token={token} manageKey={manageKey} />
      </section>

      {tasks.length ? (
        <section aria-labelledby="steps-title" className="rounded-2xl border border-border-200 bg-white p-5">
          <h2 id="steps-title" className="flex items-center gap-2 text-lg font-semibold text-primary-700">
            <ListChecks size={20} aria-hidden="true" /> Next steps
          </h2>
          <p className="mt-1 text-sm text-ink-500">Outstanding first. Updates show who made them and how.</p>
          <ul className="mt-3 divide-y divide-border-200">
            {[...open, ...completed].map((t) => {
              const s = state[t.id];
              const assignee = nameFor(s?.assigneeId) ?? t.assignee;
              const late = t.dueDate && t.dueDate < today() && s?.status !== "completed";
              return (
                <li key={t.id} className="py-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="min-w-0 flex-1 font-medium">{t.title}</p>
                    {s ? <StatusChip status={s.status} /> : null}
                  </div>
                  <p className="mt-0.5 text-sm text-ink-500">
                    {assignee ? `For ${assignee}` : "Not assigned"}
                    {assignee && !s?.assigneeId ? " (not invited, so only you can update it)" : ""}
                    {t.dueDate ? ` · by ${longDate(t.dueDate)}` : t.dueText ? ` · ${t.dueText}` : ""}
                    {late ? <strong className="ml-1 text-med-ink">Overdue</strong> : null}
                  </p>
                  <Attribution s={s} />
                  {s ? (
                    <details className="mt-1">
                      <summary className="cursor-pointer text-sm font-semibold text-primary-700">Update status yourself</summary>
                      <TaskStatusControl
                        taskTitle={t.title}
                        value={s}
                        onSave={async (status: TaskStatusValue, note?: string) => {
                          const r = await call(`/api/handoffs/${token}/tasks`, manageKey, { taskId: t.id, status, note });
                          if (!r.ok) return r;
                          setState((m) => ({ ...m, [t.id]: r.data.taskStatus }));
                          return { ok: true };
                        }}
                      />
                    </details>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="activity-title" className="rounded-2xl border border-border-200 bg-white p-5">
        <h2 id="activity-title" className="flex items-center gap-2 text-lg font-semibold text-primary-700">
          <History size={20} aria-hidden="true" /> Recent activity
        </h2>
        {events.length ? (
          <ul className="mt-3 space-y-2">
            {events.map((e) => (
              <li key={e.id} className="flex flex-wrap justify-between gap-x-4 text-[0.95rem]">
                <span>{e.text}</span>
                <span className="text-sm text-ink-500">{dateTime(e.at)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-ink-500">Nothing yet.</p>
        )}
        <p className="mt-3 text-xs text-ink-500">{creator ? `“You” is ${creator}, using this manage link.` : "“You” means this manage link."}</p>
      </section>
    </div>
  );
}

function AddPerson({ token, manageKey }: { token: string; manageKey: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("family");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setTimeout(() => nameRef.current?.focus(), 0);
        }}
        className="mt-2 inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 font-medium text-primary-700 hover:bg-sky-100"
      >
        <Plus size={18} aria-hidden="true" /> Add a person
      </button>
    );
  }
  return (
    <div className="mt-3 rounded-xl border border-border-200 p-4">
      <label htmlFor="add-name" className="text-sm font-medium">
        Name
      </label>
      <input
        ref={nameRef}
        id="add-name"
        value={name}
        maxLength={80}
        onChange={(e) => setName(e.target.value)}
        className="mt-1 h-11 w-full rounded-lg border border-border-200 bg-white px-3 outline-none focus:border-action-500 focus:ring-2 focus:ring-action-500/30"
      />
      <div className="mt-3">
        <RoleChips name={name} value={role} onChange={setRole} />
      </div>
      <p className="mt-2 text-sm text-ink-500">They will see everything, including all next steps. Steps already assigned to this name become theirs.</p>
      {error ? (
        <p role="alert" className="mt-2 text-sm text-attn-ink">
          {error}
        </p>
      ) : null}
      {url ? (
        <CopyBox url={url} label={`Personal link for ${name}`} />
      ) : (
        <button
          type="button"
          disabled={busy || !name.trim()}
          onClick={async () => {
            setBusy(true);
            setError(null);
            const r = await call(`/api/handoffs/${token}/recipients`, manageKey, { name: name.trim(), role });
            setBusy(false);
            if (!r.ok) return setError(r.message);
            setUrl(r.data.url);
            router.refresh();
          }}
          className="mt-3 min-h-11 rounded-lg bg-primary-700 px-4 font-semibold text-white disabled:opacity-50"
        >
          {busy ? "Creating…" : "Create their link"}
        </button>
      )}
    </div>
  );
}

