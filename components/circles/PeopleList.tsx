import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { dateTime } from "@/lib/format";
import type { PersonView } from "@/lib/schema/circles";

/** Read-only list of the people on a circle. "Last opened" shows only when the viewer may manage people. */
export function PeopleList({ people, showSeen }: { people: PersonView[]; showSeen: boolean }) {
  return (
    <ul className="divide-y divide-border-200">
      {people.map((person) => (
        <li key={`${person.kind}-${person.id}`} className="flex items-center gap-3 py-3">
          <Avatar name={person.name} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-ink-900">{person.name}</p>
            <p className="text-sm text-ink-500">
              {person.roleLabel}
              {showSeen && person.kind === "member" && !person.revokedAt ? ` · Last opened ${person.lastSeenAt ? dateTime(person.lastSeenAt) : "not yet"}` : ""}
            </p>
          </div>
          {person.revokedAt ? <Badge tone="attn">Access removed</Badge> : person.locked ? <Badge tone="attn">Locked</Badge> : null}
        </li>
      ))}
    </ul>
  );
}
