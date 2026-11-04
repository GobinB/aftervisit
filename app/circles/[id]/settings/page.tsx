import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { CircleFrame, circleTabs, roleLine } from "@/components/circles/CircleFrame";
import { DeleteCircle } from "@/components/circles/DeleteCircle";
import { RotateKey } from "@/components/circles/RotateKey";
import { CircleShell } from "@/components/circles/Shell";
import { getActor } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getCircle, listOwnCircleKeys } from "@/services/circles";

export const metadata: Metadata = { title: "Settings", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function SettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await getActor(id);
  if (!actor) redirect(`/login?next=/circles/${id}/settings`);
  if (actor.kind !== "caregiver") notFound();
  const canRotate = actor.role === "owner" && can(actor, "circle:rotate_key", { circleId: id });
  const canDelete = can(actor, "circle:delete", { circleId: id });
  if (!canRotate && !canDelete) notFound();
  const content = await getCircle(actor, id);
  if (!content) notFound();
  const key = (await listOwnCircleKeys(actor)).find((item) => item.circleId === id) ?? null;
  return (
    <CircleShell signedIn circle={{ personName: content.person_name, tabs: circleTabs(actor, id), active: "settings" }}>
      <CircleFrame personName={content.person_name} subtitle={roleLine(actor)} tabs={circleTabs(actor, id)} active="settings">
        <div className="max-w-xl space-y-6">
          {key && canRotate ? (
            <section aria-labelledby="key-title" className="rounded-2xl border border-border-200 bg-white p-5 sm:p-6">
              <h2 id="key-title" className="font-display border-b border-border-200 pb-3 text-section text-primary-900">
                Key for files
              </h2>
              <p className="mt-4 text-ink-500">
                If your recovery words may have been seen by someone else, make a new key. Every helper link is replaced, so send each person their
                new link.
              </p>
              <div className="mt-4">
                <RotateKey circle={key} />
              </div>
            </section>
          ) : null}
          {canDelete ? (
            <section aria-labelledby="delete-title" className="rounded-2xl border border-border-200 bg-white p-5 sm:p-6">
              <h2 id="delete-title" className="font-display border-b-2 border-attn pb-3 text-section text-attn-ink">
                Delete this circle
              </h2>
              <p className="mt-4 text-ink-500">This removes the circle for everyone on it and turns off every helper link. It cannot be undone here.</p>
              <div className="mt-4">
                <DeleteCircle circleId={id} />
              </div>
            </section>
          ) : null}
        </div>
      </CircleFrame>
    </CircleShell>
  );
}
