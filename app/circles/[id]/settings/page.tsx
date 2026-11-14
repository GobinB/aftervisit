import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { CircleFrame, circleTabs, roleLine } from "@/components/circles/CircleFrame";
import { DeleteCircle } from "@/components/circles/DeleteCircle";
import { getActor } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getCircle } from "@/services/circles";

export const metadata: Metadata = { title: "Settings", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function SettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await getActor(id);
  if (!actor) redirect(`/login?next=/circles/${id}/settings`);
  if (actor.kind !== "caregiver") notFound();
  const canDelete = can(actor, "circle:delete", { circleId: id });
  if (!canDelete) notFound();
  const content = await getCircle(actor, id);
  if (!content) notFound();
  return (
    <>
      <CircleFrame personName={content.person_name} subtitle={roleLine(actor)} tabs={circleTabs(actor, id)} help="Rarely needed. Delete this circle." active="settings">
        <div className="max-w-xl space-y-6">
          {canDelete ? (
            <section aria-labelledby="delete-title" className="rounded-2xl border border-border-200 bg-white p-5 sm:p-6">
              <h2 id="delete-title" className="font-display border-b-2 border-attn pb-3 text-section text-attn-ink">
                Delete this circle
              </h2>
              <p className="mt-4 text-ink-500">Nobody can open the circle again and every link stops working, right away. Everything in it is erased for good after 30 days.</p>
              <div className="mt-4">
                <DeleteCircle circleId={id} />
              </div>
            </section>
          ) : null}
        </div>
      </CircleFrame>
    </>
  );
}
