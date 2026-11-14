import type { Actor } from "@/lib/auth";
import { UPDATE_AREAS, type UpdateArea } from "@/lib/link-life";
import { can, type Action } from "@/lib/permissions";
import type { HelperRole, Visibility } from "@/lib/schema/circles";

/** What a person must be able to see for a change in that area to matter to them. */
const READ: Record<UpdateArea, Action[]> = {
  medications: ["medications:read"],
  calendar: ["calendar:read"],
  tasks: ["tasks:read", "tasks:read:own"],
  summary: ["summary:read"],
};

export type UpdateRow = { area: UpdateArea; changedAt: string };

export type HelperForUpdates = {
  id: string;
  circleId: string;
  name: string;
  role: HelperRole;
  visibility: Visibility;
  lastSeenAt: string | null;
  lastToldAt: string | null;
  linkIssuedAt: string;
};

export type PendingUpdate = { memberId: string; name: string; areas: UpdateArea[] };

const time = (value: string | null) => (value ? new Date(value).getTime() : 0);

/**
 * Who has not heard about the caregiver's latest changes: for each person, the areas they can see
 * that changed after they last opened their link, were last sent it, or were given it.
 */
export function whoNeedsUpdate(updates: readonly UpdateRow[], helpers: readonly HelperForUpdates[]): PendingUpdate[] {
  const pending: PendingUpdate[] = [];
  for (const helper of helpers) {
    const actor: Actor = { kind: "helper", memberId: helper.id, circleId: helper.circleId, role: helper.role, visibility: helper.visibility };
    const heard = Math.max(time(helper.lastSeenAt), time(helper.lastToldAt), time(helper.linkIssuedAt));
    const areas = UPDATE_AREAS.filter((area) => {
      const row = updates.find((update) => update.area === area);
      if (!row || time(row.changedAt) <= heard) return false;
      // "Their own reminders" counts: a change there may be a reminder given to them.
      return READ[area].some((action) => can(actor, action, { circleId: helper.circleId, assigneeId: helper.id }));
    });
    if (areas.length) pending.push({ memberId: helper.id, name: helper.name, areas });
  }
  return pending;
}
