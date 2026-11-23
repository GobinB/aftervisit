import { circleTabs } from "@/components/circles/CircleFrame";
import { CircleShell } from "@/components/circles/Shell";
import { RecordTimeZone } from "@/components/circles/RecordTimeZone";
import { ShareUpdates } from "@/components/circles/ShareUpdates";
import { getActor } from "@/lib/auth";
import { getCircle, listCircles } from "@/services/circles";
import { getCircleRunner, getPendingUpdates } from "@/services/members";

/**
 * The circle's frame (sidebar, header, phone bar), drawn once and kept on screen while moving
 * between areas, so a click changes only the page inside. Pages still check access themselves
 * and send a signed-out visitor to sign in with the right return address.
 */
export default async function CircleLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await getActor(id);
  if (!actor) return <>{children}</>;
  // Someone signed in (who runs this circle, or helps in it through their account) gets Sign out and a switcher between their circles.
  const signedIn = actor.kind === "caregiver" || Boolean(actor.userId);
  const account = signedIn ? await getActor() : null;
  const [content, pending, circles, runner] = await Promise.all([
    getCircle(actor, id),
    getPendingUpdates(actor, id),
    account ? listCircles(account) : Promise.resolve([]),
    getCircleRunner(actor, id),
  ]);
  return (
    <CircleShell
      signedIn={signedIn}
      circles={circles}
      circle={{ personName: content?.person_name ?? "Your care circle", tabs: circleTabs(actor, id), runner }}
    >
      {/* After the caregiver changes something, the people who can see it are offered their same link with a note. */}
      {actor.kind === "caregiver" && content && !content.time_zone ? <RecordTimeZone circleId={id} /> : null}
      {pending.length ? <ShareUpdates circleId={id} personName={content?.person_name ?? "your person"} pending={pending} /> : null}
      {children}
    </CircleShell>
  );
}
