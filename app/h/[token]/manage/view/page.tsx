import type { Metadata } from "next";
import Link from "next/link";
import { CreatorView } from "@/components/handoff/clients";
import { GonePage } from "@/components/handoff/GonePage";
import { lookup } from "@/lib/access";
import { toView } from "@/lib/db";
import { recipientsFor, taskStatusRows, toStatusView } from "@/lib/invites";
import { originalLink } from "@/lib/storage";
import { hashManageKey, MANAGE_KEY_RE, safeEqual } from "@/lib/tokens";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Full handoff", robots: { index: false, follow: false, nocache: true }, referrer: "no-referrer" };

type Props = { params: Promise<{ token: string }>; searchParams: Promise<{ key?: string; print?: string }> };

/** The caregiver's complete view of the handoff (every section), for reading or printing. */
export default async function CreatorViewPage({ params, searchParams }: Props) {
  const { token } = await params;
  const { key = "", print } = await searchParams;
  const invalid = (
    <main className="mx-auto max-w-[640px] px-4 py-20 text-center">
      <h1 className="font-display text-2xl text-primary-900">This link is not valid</h1>
      <Link href="/" className="mt-6 inline-block font-semibold text-primary-700 underline underline-offset-4">
        Go to AfterVisit
      </Link>
    </main>
  );
  if (!MANAGE_KEY_RE.test(key)) return invalid;
  const found = await lookup(token, { forCreator: true });
  if (found.status !== "ok") return found.status === "not_found" ? invalid : <GonePage status={found.status} />;
  if (!safeEqual(hashManageKey(key), found.row.manage_key_hash)) return invalid;

  const row = found.row;
  const [statuses, people] = row.access_mode === "invite" ? await Promise.all([taskStatusRows(token), recipientsFor(token)]) : [[], []];
  const view = toView(row);
  if (people.length) view.recipients = people.filter((p) => !p.revoked_at).map((p) => ({ name: p.name, role: p.role }));
  return (
    <CreatorView
      view={view}
      taskStatus={Object.fromEntries(statuses.map((s) => [s.task_id, toStatusView(s)]))}
      originalUrl={row.original_path ? originalLink(token) : null}
      autoPrint={print === "1"}
    />
  );
}
