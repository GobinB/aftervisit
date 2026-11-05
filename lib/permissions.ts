import type { Actor, CaregiverRole } from "@/lib/auth";
import type { HelperRole, VisibilityArea } from "@/lib/schema/circles";

/**
 * Default deny. Every role has one cell per action. Add a role or an action in
 * both lists or `tests/unit/permissions.test.ts` fails.
 * Cell meanings:
 * - allow: the role can do it
 * - deny: the role cannot
 * - not-owner: can, except when the subject is the circle owner
 * - own: a helper can, only when subject.assigneeId is their member id
 * - sections: a helper can read a handoff section only when it was chosen for them
 */
export const ACTIONS = [
  "members:manage",
  "members:remove",
  "members:read",
  "members:read:caregivers",
  "updates:read",
  "updates:read:family",
  "updates:post",
  "medications:read",
  "medications:edit",
  "medications:print",
  "tasks:read",
  "tasks:read:own",
  "tasks:claim",
  "tasks:update",
  "tasks:update:own",
  "tasks:manage",
  "calendar:read",
  "calendar:edit",
  "documents:read",
  "documents:read:legal",
  "documents:read:care",
  "handoff:create",
  "handoff:confirm",
  "handoff:read",
  "summary:read",
  "summary:print",
  "summary:edit",
  "export:download",
  "circle:delete",
  "circle:rotate_key",
] as const;

export type Action = (typeof ACTIONS)[number];
export type Cell = "allow" | "deny" | "not-owner" | "own" | "sections";
export type Role = CaregiverRole | HelperRole;

export const ROLES = ["owner", "family", "care_manager", "home_aide", "day_program"] as const satisfies readonly Role[];

export type Subject = {
  circleId?: string;
  /** Set when the action targets a person, for "not-owner" cells. */
  targetRole?: Role;
  /** Task assignee. Required for "own" cells. */
  assigneeId?: string;
  /** Handoff section id. Required for "sections" cells. */
  section?: string;
};

function row(cells: readonly Cell[]): Record<Action, Cell> {
  if (cells.length !== ACTIONS.length) {
    throw new Error(`permissions grid has ${cells.length} cells, expected ${ACTIONS.length}`);
  }
  return Object.fromEntries(ACTIONS.map((action, index) => [action, cells[index]])) as Record<Action, Cell>;
}

// Column order is ACTIONS. Do not sort.
const OWNER: Cell[] = [
  "allow", "allow", "allow", "allow",
  "allow", "allow", "allow",
  "allow", "allow", "deny",
  "allow", "allow", "allow", "allow", "allow", "allow",
  "allow", "allow",
  "allow", "allow", "allow",
  "allow", "allow", "allow",
  "allow", "allow", "allow",
  "allow",
  "allow",
  "allow",
];

const FAMILY: Cell[] = [
  "deny", "deny", "allow", "allow",
  "allow", "allow", "allow",
  "allow", "deny", "deny",
  "allow", "allow", "allow", "deny", "own", "deny",
  "allow", "allow",
  "allow", "allow", "allow",
  "deny", "deny", "sections",
  "allow", "allow", "deny",
  "deny",
  "deny",
  "deny",
];

const CARE_MANAGER: Cell[] = [
  "deny", "deny", "allow", "allow",
  "allow", "deny", "deny",
  "allow", "deny", "deny",
  "allow", "allow", "deny", "deny", "own", "deny",
  "allow", "deny",
  "allow", "allow", "allow",
  "deny", "deny", "sections",
  "allow", "allow", "deny",
  "deny",
  "deny",
  "deny",
];

const AIDE: Cell[] = [
  "deny", "deny", "deny", "allow",
  "deny", "deny", "deny",
  "allow", "deny", "allow",
  "deny", "own", "deny", "deny", "own", "deny",
  "allow", "deny",
  "deny", "deny", "allow",
  "deny", "deny", "sections",
  "allow", "allow", "deny",
  "deny",
  "deny",
  "deny",
];

export const GRID: Record<Role, Record<Action, Cell>> = {
  owner: row(OWNER),
  family: row(FAMILY),
  care_manager: row(CARE_MANAGER),
  home_aide: row(AIDE),
  day_program: row(AIDE),
};

const AREA_OF: Partial<Record<Action, VisibilityArea>> = {
  "updates:read": "updates",
  "updates:read:family": "updates",
  "updates:post": "updates",
  "medications:read": "medications",
  "medications:edit": "medications",
  "medications:print": "medications",
  "tasks:read": "tasks",
  "tasks:read:own": "tasks",
  "tasks:claim": "tasks",
  "tasks:update": "tasks",
  "tasks:update:own": "tasks",
  "tasks:manage": "tasks",
  "calendar:read": "calendar",
  "calendar:edit": "calendar",
  "documents:read": "documents",
  "documents:read:legal": "documents",
  "documents:read:care": "documents",
  "handoff:create": "handoff",
  "handoff:confirm": "handoff",
  "handoff:read": "handoff",
  "summary:read": "summary",
  "summary:print": "summary",
  "summary:edit": "summary",
};

function inCircle(actor: Actor, circleId: string): boolean {
  return actor.kind === "helper" ? actor.circleId === circleId : actor.circleIds.includes(circleId);
}

function narrowed(actor: Actor, action: Action): boolean {
  if (actor.kind !== "helper") return false;
  const area = AREA_OF[action];
  if (area && actor.visibility.hidden?.includes(area)) return true;
  if (actor.visibility.members === "off" && (action === "members:read" || action === "members:read:caregivers")) return true;
  if (actor.visibility.members === "caregivers" && action === "members:read") return true;
  return false;
}

/** Unknown actions and missing roles are denied. Visibility can only remove access. */
export function can(actor: Actor, action: Action, subject?: Subject): boolean {
  if (!actor.role) return false;
  const cell = GRID[actor.role]?.[action];
  if (!cell) return false;
  if (subject?.circleId && !inCircle(actor, subject.circleId)) return false;
  if (narrowed(actor, action)) return false;
  if (cell === "allow") return true;
  if (cell === "deny") return false;
  if (cell === "not-owner") return subject?.targetRole !== "owner";
  if (cell === "own") {
    return actor.kind === "helper" && !!subject?.assigneeId && subject.assigneeId === actor.memberId;
  }
  if (cell === "sections") {
    return (
      actor.kind === "helper" &&
      !!subject?.section &&
      (actor.visibility.handoffSections ?? []).some((section) => section === subject.section)
    );
  }
  return false;
}
