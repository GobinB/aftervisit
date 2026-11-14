import { circleTabs } from "@/components/circles/CircleFrame";
import { CircleKeyCheck } from "@/components/circles/CircleKeyCheck";
import { CircleShell } from "@/components/circles/Shell";
import { getActor } from "@/lib/auth";
import { getCircleKeyState } from "@/services/circle-keys";
import { getCircle } from "@/services/circles";

/**
 * The circle's frame (sidebar, header, phone bar), drawn once and kept on screen while moving
 * between areas, so a click changes only the page inside. Pages still check access themselves
 * and send a signed-out visitor to sign in with the right return address.
 */
export default async function CircleLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await getActor(id);
  if (!actor) return <>{children}</>;
  const [content, key] = await Promise.all([getCircle(actor, id), getCircleKeyState(actor, id)]);
  return (
    <CircleShell signedIn={actor.kind === "caregiver"} circle={{ personName: content?.person_name ?? "Your care circle", tabs: circleTabs(actor, id) }}>
      {/* A device that still has a key made with recovery words hands it over here, on any page of the circle. */}
      {key?.state === "words" ? <CircleKeyCheck circleId={id} quiet /> : null}
      {children}
    </CircleShell>
  );
}
