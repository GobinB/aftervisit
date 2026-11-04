import type { Metadata } from "next";
import type { ReactNode } from "react";
import { CaptureLinkKey } from "@/components/circles/CaptureLinkKey";
import { OpenMemberLink } from "@/components/circles/OpenMemberLink";
import { InviteHandoff } from "@/components/handoff/clients";
import { GonePage } from "@/components/handoff/GonePage";
import { ogTitle } from "@/lib/copy";
import { inviteView, lookupInvite, recordOpen, taskStatusRows } from "@/lib/invites";
import { inviteOriginalLink } from "@/lib/storage";
import { previewMemberLink } from "@/services/members";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ invite: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { invite } = await params;
  let title = "Care update";
  try {
    const found = await lookupInvite(invite);
    if (found.status === "ok" && !found.row.pin_hash) title = ogTitle(found.row.payload);
  } catch {}
  const description = "A care update was shared with you through All Hands Care.";
  return {
    title: { absolute: title },
    description,
    robots: { index: false, follow: false, nocache: true },
    referrer: "no-referrer",
    openGraph: { title, description, type: "article" },
  };
}

/** A person's own link. Member links set a helper session. Older handoff invites keep working. */
export default async function InvitePage({ params }: Props) {
  const { invite } = await params;
  return (
    <>
      <CaptureLinkKey token={invite} />
      {await inviteBody(invite)}
    </>
  );
}

async function inviteBody(invite: string): Promise<ReactNode> {
  const member = await previewMemberLink(invite);
  if (member.status === "revoked" || member.status === "expired") return <GonePage status={member.status} />;
  if (member.status === "locked") {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-surface-50 px-4">
        <OpenMemberLink token={invite} mode="pin" lockedMessage={member.message} />
      </div>
    );
  }
  if (member.status === "pin" || member.status === "ready") {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-surface-50 px-4">
        <OpenMemberLink token={invite} mode={member.status} />
      </div>
    );
  }
  const found = await lookupInvite(invite);
  if (found.status !== "ok") return <GonePage status={found.status} />;
  if (found.row.pin_hash) return <InviteHandoff invite={invite} />;
  await recordOpen(found.recipient);
  const view = inviteView(found.row, found.recipient, await taskStatusRows(found.row.token));
  return <InviteHandoff invite={invite} view={view} originalUrl={view.hasOriginal ? inviteOriginalLink(invite) : null} />;
}
