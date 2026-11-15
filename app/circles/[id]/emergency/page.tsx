import { Siren } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CallButton } from "@/components/circles/CallButton";
import { PageHead } from "@/components/circles/PageHead";
import { PhoneField } from "@/components/circles/PhoneField";
import { roleLine } from "@/components/circles/CircleFrame";
import { PrintButton } from "@/components/medications/PrintButton";
import { getActor } from "@/lib/auth";
import { emergencyPeople } from "@/lib/emergency";
import { can } from "@/lib/permissions";
import { getCircle } from "@/services/circles";
import { getOwnPhone, listPeople } from "@/services/members";

export const metadata: Metadata = { title: "Emergency", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * Who to call, in a hurry. Emergency contacts from the care summary first, then the people in the
 * circle who have a number, then allergies. Each part shows only to someone who may already see it:
 * the care summary's parts need "summary:read", people's numbers the People list.
 */
export default async function EmergencyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await getActor(id);
  if (!actor) redirect(`/login?next=/circles/${id}/emergency`);
  if (!can(actor, "emergency:read", { circleId: id })) notFound();
  const helper = actor.kind === "helper";
  const [content, listed, ownPhone] = await Promise.all([
    getCircle(actor, id),
    listPeople(actor, id),
    helper ? getOwnPhone(actor, id) : Promise.resolve(null),
  ]);
  const caregiver = actor.kind === "caregiver";
  const self = helper ? actor.memberId : actor.userId;
  const people = listed.ok ? emergencyPeople(listed.people, self) : null;
  const personName = content?.person_name ?? "Your care circle";
  const contacts = content?.emergency_contacts ?? [];

  return (
    <>
      <PageHead
        title="Emergency"
        subtitle={`${personName} · ${roleLine(actor)}`}
        help="Who to call, with one tap, and the allergies to tell a doctor or paramedic. Print it to keep by the phone."
        actions={<PrintButton />}
      />

      <div className="max-w-3xl space-y-5">
        <p className="print-plain flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-attn/30 bg-attn-bg px-4 py-3 text-[15px] text-attn-ink">
          <Siren className="size-5 shrink-0" aria-hidden="true" />
          <span className="font-semibold">If someone is in danger, call 911 first.</span>
        </p>

        {content ? (
          <Section title="Emergency contacts" id="contacts-title">
            {contacts.length ? (
              <ul className="divide-y divide-border-200">
                {contacts.map((contact, index) => (
                  <Row key={`${contact.name}-${index}`} name={contact.name} detail={contact.relationship}>
                    {contact.phone ? <CallButton phone={contact.phone} name={contact.name} /> : <span className="text-[14px] text-ink-500">No number written down</span>}
                  </Row>
                ))}
              </ul>
            ) : (
              <p className="py-2 text-ink-500">No emergency contact yet.</p>
            )}
            {caregiver ? (
              <Link href={`/circles/${id}/summary/edit`} className="no-print mt-2 inline-flex min-h-11 items-center text-[15px] font-semibold text-primary-700 hover:text-primary-900">
                {contacts.length ? "Change emergency contacts" : "Add an emergency contact"}
              </Link>
            ) : null}
          </Section>
        ) : null}

        {people ? (
          <Section title="People in the circle" id="people-title">
            {people.withPhone.length ? (
              <ul className="divide-y divide-border-200">
                {people.withPhone.map((person) => (
                  <Row key={`${person.kind}-${person.id}`} name={person.name} detail={person.roleLabel}>
                    <CallButton phone={person.phone as string} name={person.name} />
                  </Row>
                ))}
              </ul>
            ) : (
              <p className="py-2 text-ink-500">Nobody has added a phone number yet.</p>
            )}
            {caregiver && people.withoutPhone.length ? (
              <p className="no-print mt-2 text-[14px] text-ink-500">
                No number yet for {people.withoutPhone.map((person) => person.name).join(", ")}.{" "}
                <Link href={`/circles/${id}/members`} className="font-semibold text-primary-700 underline-offset-4 hover:underline">
                  Add numbers on People
                </Link>
              </p>
            ) : null}
            {caregiver && !people.ownPhone ? (
              <p className="no-print mt-2 text-[14px] text-ink-500">
                Your own number is not here yet, so people cannot tap to call you.{" "}
                <Link href={`/circles/${id}/settings`} className="font-semibold text-primary-700 underline-offset-4 hover:underline">
                  Add it in Settings
                </Link>
              </p>
            ) : null}
          </Section>
        ) : null}

        {content ? (
          <Section title="Allergies" id="allergies-title">
            {content.allergies.length ? (
              <ul className="flex flex-wrap gap-2 py-1">
                {content.allergies.map((item) => (
                  <li key={item} className="print-plain rounded-md bg-attn-bg px-2.5 py-1 text-[16px] font-semibold text-attn-ink">
                    {item}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-2 text-ink-500">No allergies written down.</p>
            )}
          </Section>
        ) : null}

        {helper && can(actor, "phone:edit:own", { circleId: id }) ? (
          <section aria-labelledby="own-phone-title" className="no-print rounded-lg border border-border-200 bg-white p-4 sm:p-5">
            <h2 id="own-phone-title" className="font-display text-[20px] text-primary-900">
              Your phone number
            </h2>
            <p className="mt-1 mb-3 text-[14px] text-ink-500">So the caregiver, and family and care managers in this circle, can tap to call you.</p>
            <PhoneField circleId={id} initial={ownPhone} label="Your number" help="Leave it blank and save to remove it." />
          </section>
        ) : null}
      </div>
    </>
  );
}

function Section({ title, id, children }: { title: string; id: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="print-plain rounded-lg border border-border-200 bg-white px-4 py-3 sm:px-5">
      <h2 id={id} className="font-display text-[20px] text-primary-900">
        {title}
      </h2>
      <div className="mt-1">{children}</div>
    </section>
  );
}

function Row({ name, detail, children }: { name: string; detail?: string; children: React.ReactNode }) {
  return (
    <li className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <span className="min-w-0">
        <span className="block text-[16px] font-semibold text-ink-900">{name}</span>
        {detail ? <span className="block text-[14px] text-ink-500">{detail}</span> : null}
      </span>
      {children}
    </li>
  );
}
