import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { CircleFrame, circleTabs, roleLine } from "@/components/circles/CircleFrame";
import { TimeZoneNote } from "@/components/calendar/TimeZoneNote";
import { DeleteCircle } from "@/components/circles/DeleteCircle";
import { PhoneField } from "@/components/circles/PhoneField";
import { getActor } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getCircle } from "@/services/circles";
import { getOwnPhone } from "@/services/members";

export const metadata: Metadata = { title: "Settings", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function SettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await getActor(id);
  if (!actor) redirect(`/login?next=/circles/${id}/settings`);
  if (actor.kind !== "caregiver") notFound();
  const canDelete = can(actor, "circle:delete", { circleId: id });
  if (!canDelete) notFound();
  const [content, ownPhone] = await Promise.all([getCircle(actor, id), getOwnPhone(actor, id)]);
  if (!content) notFound();
  return (
    <>
      <CircleFrame personName={content.person_name} subtitle={roleLine(actor)} tabs={circleTabs(actor, id)} help="Your phone number, the time zone where the person lives, and deleting this circle." active="settings">
        <div className="max-w-xl space-y-6">
          <section aria-labelledby="phone-title" className="rounded-2xl border border-border-200 bg-white p-5 sm:p-6">
            <h2 id="phone-title" className="font-display border-b border-border-200 pb-3 text-section text-primary-900">
              Your phone number
            </h2>
            <p className="mt-4 mb-3 text-ink-500">People in the circle see it on People and on the Emergency page, so they can tap to call you.</p>
            <PhoneField circleId={id} initial={ownPhone} label="Your number" help="Leave it blank and save to remove it." />
          </section>
          <section aria-labelledby="zone-title" className="rounded-2xl border border-border-200 bg-white p-5 sm:p-6">
            <h2 id="zone-title" className="font-display border-b border-border-200 pb-3 text-section text-primary-900">
              Where {content.person_name} lives
            </h2>
            <p className="mt-4 text-ink-500">The time zone for {content.person_name}&apos;s dates, and for medicine and appointment times in the calendar link.</p>
            <TimeZoneNote circleId={id} timeZone={content.time_zone ?? null} personName={content.person_name} />
          </section>
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
