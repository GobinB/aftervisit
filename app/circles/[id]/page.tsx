import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { DeleteCircle } from "@/components/circles/DeleteCircle";
import { RestoreKeys } from "@/components/circles/RestoreKeys";
import { RotateKey } from "@/components/circles/RotateKey";
import { CircleShell } from "@/components/circles/Shell";
import { ButtonLink } from "@/components/ui/Button";
import { getActor } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getCircle, listOwnCircleKeys } from "@/services/circles";
import type { CircleContent } from "@/lib/schema/circles";

export const metadata: Metadata = { title: "Circle", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function CircleHome({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await getActor(id);
  if (!actor) redirect(`/login?next=/circles/${id}`);
  const content = await getCircle(actor, id);
  if (!content && actor.kind === "caregiver") notFound();
  const showSummary = can(actor, "summary:read", { circleId: id });
  const showPeople = can(actor, "members:read", { circleId: id }) || can(actor, "members:read:caregivers", { circleId: id }) || can(actor, "members:manage", { circleId: id });
  const keys = actor.kind === "caregiver" ? await listOwnCircleKeys(actor) : [];
  const key = keys.find((item) => item.circleId === id) ?? null;
  return (
    <CircleShell>
      <p className="text-sm font-semibold tracking-wide text-primary-700 uppercase">{actor.kind === "caregiver" ? (actor.role === "owner" ? "Owner" : "Co-caregiver") : "Personal link"}</p>
      <h1 className="font-display mt-2 text-page text-primary-900">{content?.person_name ?? "Circle"}</h1>
      {key ? <RestoreKeys circles={[key]} /> : null}
      {showSummary && content ? <Summary content={content} /> : <p className="mt-4 text-ink-500">The summary is not shared with you.</p>}
      <div className="mt-8 grid gap-3">
        {showPeople ? (
          <ButtonLink href={`/circles/${id}/members`} variant="secondary" className="w-full">
            People
          </ButtonLink>
        ) : null}
        <Link href="/circles" className="inline-flex min-h-12 items-center justify-center font-semibold text-primary-700">
          All circles
        </Link>
        {key && can(actor, "circle:rotate_key", { circleId: id }) ? <RotateKey circle={key} /> : null}
        {can(actor, "circle:delete", { circleId: id }) ? <DeleteCircle circleId={id} /> : null}
      </div>
    </CircleShell>
  );
}

function Summary({ content }: { content: CircleContent }) {
  return (
    <dl className="mt-6 space-y-5">
      <Block label="Allergies">
        {content.allergies.length ? (
          <ul className="list-disc pl-5">
            {content.allergies.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : (
          <p>None recorded.</p>
        )}
      </Block>
      <Block label="Doctors">
        {content.doctors.length ? (
          <ul className="space-y-2">
            {content.doctors.map((doctor) => (
              <li key={`${doctor.name}-${doctor.phone ?? ""}`}>
                {doctor.name}
                {doctor.specialty ? `, ${doctor.specialty}` : ""}
                {doctor.phone ? ` · ${doctor.phone}` : ""}
              </li>
            ))}
          </ul>
        ) : (
          <p>None recorded.</p>
        )}
      </Block>
      <Block label="Pharmacy">
        {content.pharmacy?.name ? (
          <p>
            {content.pharmacy.name}
            {content.pharmacy.phone ? ` · ${content.pharmacy.phone}` : ""}
            {content.pharmacy.address ? ` · ${content.pharmacy.address}` : ""}
          </p>
        ) : (
          <p>None recorded.</p>
        )}
      </Block>
      <Block label="Emergency contacts">
        {content.emergency_contacts.length ? (
          <ul className="space-y-2">
            {content.emergency_contacts.map((contact) => (
              <li key={`${contact.name}-${contact.phone ?? ""}`}>
                {contact.name}
                {contact.relationship ? `, ${contact.relationship}` : ""}
                {contact.phone ? ` · ${contact.phone}` : ""}
              </li>
            ))}
          </ul>
        ) : (
          <p>None recorded.</p>
        )}
      </Block>
      {content.poa_location ? (
        <Block label="Where the power of attorney is kept">
          <p>{content.poa_location}</p>
        </Block>
      ) : null}
    </dl>
  );
}

function Block({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="font-semibold text-ink-900">{label}</dt>
      <dd className="mt-1 text-ink-900">{children}</dd>
    </div>
  );
}
