import type { PersonView } from "@/lib/schema/circles";

/**
 * The People part of the Emergency page, from the People list the viewer may already see.
 * - withPhone: everyone else with a number, the caregiver first. Nobody is offered a call to themselves.
 * - withoutPhone: people with a link and no number yet, so the caregiver can add them.
 * - ownPhone: the viewer's own number, when the list shows it.
 * A person whose link was turned off is left out: they are no longer in the circle.
 */
export function emergencyPeople(people: PersonView[], selfId: string) {
  const current = people.filter((person) => !person.revokedAt);
  const others = current.filter((person) => person.id !== selfId);
  const withPhone = others
    .filter((person) => Boolean(person.phone?.trim()))
    .sort((a, b) => (a.kind === b.kind ? 0 : a.kind === "caregiver" ? -1 : 1));
  const withoutPhone = others.filter((person) => person.kind === "member" && !person.phone?.trim());
  const ownPhone = current.find((person) => person.id === selfId)?.phone ?? null;
  return { withPhone, withoutPhone, ownPhone };
}
