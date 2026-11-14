import { circleTabs } from "@/components/circles/CircleFrame";
import { CircleShell } from "@/components/circles/Shell";
import { ShareUpdates } from "@/components/circles/ShareUpdates";
import { getActor } from "@/lib/auth";
import { getCircle } from "@/services/circles";
import { getPendingUpdates } from "@/services/members";

/**
 * The circle's frame (sidebar, header, phone bar), drawn once and kept on screen while moving
 * between areas, so a click changes only the page inside. Pages still check access themselves
 * and send a signed-out visitor to sign in with the right return address.
 */
export default async function CircleLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await getActor(id);
  if (!actor) return <>{children}</>;
  const [content, pending] = await Promise.all([getCircle(actor, id), getPendingUpdates(actor, id)]);
  return (
    <CircleShell signedIn={actor.kind === "caregiver"} circle={{ personName: content?.person_name ?? "Your care circle", tabs: circleTabs(actor, id) }}>
      {/* After the caregiver changes something, the people who can see it are offered their same link with a note. */}
      {pending.length ? <ShareUpdates circleId={id} personName={content?.person_name ?? "your person"} pending={pending} /> : null}
      {children}
    </CircleShell>
  );
}
