import type { CircleContent } from "@/lib/schema/circles";

/**
 * The care summary as written by the caregiver. Used on the circle and, with fictional
 * content, on the home page. `compact` shows the first entries of each part only.
 */
export function SummaryView({ content, compact = false }: { content: CircleContent; compact?: boolean }) {
  const take = <T,>(items: T[]) => (compact ? items.slice(0, 2) : items);
  return (
    <dl className={`grid gap-x-10 ${compact ? "gap-y-5" : "gap-y-7 md:grid-cols-2"}`}>
      <Part label="Allergies">
        {content.allergies.length ? (
          <ul className="flex flex-wrap gap-2">
            {take(content.allergies).map((item) => (
              <li key={item} className="rounded-md bg-attn-bg px-2 py-0.5 font-medium text-attn-ink">
                {item}
              </li>
            ))}
          </ul>
        ) : (
          <None />
        )}
      </Part>
      <Part label="Doctors">
        {content.doctors.length ? (
          <ul className="space-y-2">
            {take(content.doctors).map((doctor) => (
              <li key={`${doctor.name}-${doctor.phone ?? ""}`}>
                <span className="font-medium">{doctor.name}</span>
                {doctor.specialty ? <span className="text-ink-500">, {doctor.specialty}</span> : null}
                {doctor.phone ? <span className="block text-ink-500">{doctor.phone}</span> : null}
              </li>
            ))}
          </ul>
        ) : (
          <None />
        )}
      </Part>
      {compact ? null : (
        <Part label="Pharmacy">
          {content.pharmacy?.name ? (
            <p>
              <span className="font-medium">{content.pharmacy.name}</span>
              {content.pharmacy.phone ? <span className="block text-ink-500">{content.pharmacy.phone}</span> : null}
              {content.pharmacy.address ? <span className="block text-ink-500">{content.pharmacy.address}</span> : null}
            </p>
          ) : (
            <None />
          )}
        </Part>
      )}
      <Part label="Emergency contacts">
        {content.emergency_contacts.length ? (
          <ul className="space-y-2">
            {take(content.emergency_contacts).map((contact) => (
              <li key={`${contact.name}-${contact.phone ?? ""}`}>
                <span className="font-medium">{contact.name}</span>
                {contact.relationship ? <span className="text-ink-500">, {contact.relationship}</span> : null}
                {contact.phone ? <span className="block text-ink-500">{contact.phone}</span> : null}
              </li>
            ))}
          </ul>
        ) : (
          <None />
        )}
      </Part>
      {!compact && content.poa_location ? (
        <Part label="Where the power of attorney is kept">
          <p>{content.poa_location}</p>
        </Part>
      ) : null}
    </dl>
  );
}

function Part({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-border-200 pt-3">
      <dt className="text-tag font-bold tracking-wider text-ink-500 uppercase">{label}</dt>
      <dd className="mt-2 text-ink-900">{children}</dd>
    </div>
  );
}

function None() {
  return <p className="text-ink-500">None recorded.</p>;
}
