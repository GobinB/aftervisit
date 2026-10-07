import type { Metadata } from "next";
import { InviteHandoff } from "@/components/handoff/clients";
import { GonePage } from "@/components/handoff/GonePage";
import { ogTitle } from "@/lib/copy";
import { inviteView, lookupInvite, recordOpen, taskStatusRows } from "@/lib/invites";
import { inviteOriginalLink } from "@/lib/storage";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ invite: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { invite } = await params;
  let title = "Care update";
  try {
    const found = await lookupInvite(invite);
    if (found.status === "ok" && !found.row.pin_hash) title = ogTitle(found.row.payload);
  } catch {}
  const description = "A care update was shared with you through AfterVisit.";
  return {
    title: { absolute: title },
    description,
    robots: { index: false, follow: false, nocache: true },
    referrer: "no-referrer",
    openGraph: { title, description, type: "article" },
  };
}

/** A person's own link. Shows only what the caregiver chose to share with them. */
export default async function InvitePage({ params }: Props) {
  const { invite } = await params;
  const found = await lookupInvite(invite);
  if (found.status !== "ok") return <GonePage status={found.status} />;
  if (found.row.pin_hash) return <InviteHandoff invite={invite} />;
  await recordOpen(found.recipient);
  const view = inviteView(found.row, found.recipient, await taskStatusRows(found.row.token));
  return <InviteHandoff invite={invite} view={view} originalUrl={view.hasOriginal ? inviteOriginalLink(invite) : null} />;
}
