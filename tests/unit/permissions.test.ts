import { describe, expect, test } from "vitest";
import type { Actor } from "@/lib/auth";
import { ACTIONS, GRID, ROLES, can, type Action, type Cell, type Role } from "@/lib/permissions";
import type { HelperRole, Visibility } from "@/lib/schema/circles";

const CIRCLE = "22222222-2222-4222-8222-222222222222";
const OTHER = "33333333-3333-4333-8333-333333333333";

function caregiver(role: "owner"): Actor {
  return { kind: "caregiver", userId: `user-${role}`, circleIds: [CIRCLE], role, accessToken: "token" };
}

/** Signed in with Google, but not this circle's caregiver. */
const stranger: Actor = { kind: "caregiver", userId: "user-stranger", circleIds: [], role: null, accessToken: "token" };

function helper(role: HelperRole, visibility: Visibility = { handoffSections: ["medications"] }): Actor {
  return { kind: "helper", memberId: `member-${role}`, circleId: CIRCLE, role, visibility };
}

function actor(role: Role): Actor {
  if (role === "owner") return caregiver(role);
  return helper(role);
}

function expectCell(role: Role, action: Action, cell: Cell) {
  const who = actor(role);
  const subject = { circleId: CIRCLE };
  if (cell === "allow") expect(can(who, action, subject), `${role} ${action}`).toBe(true);
  if (cell === "deny") expect(can(who, action, subject), `${role} ${action}`).toBe(false);
  if (cell === "not-owner") {
    expect(can(who, action, subject)).toBe(true);
    expect(can(who, action, { ...subject, targetRole: "owner" })).toBe(false);
    expect(can(who, action, { ...subject, targetRole: "family" })).toBe(true);
  }
  if (cell === "own") {
    expect(can(who, action, subject)).toBe(false);
    if (who.kind === "helper") {
      expect(can(who, action, { ...subject, assigneeId: who.memberId })).toBe(true);
      expect(can(who, action, { ...subject, assigneeId: "someone-else" })).toBe(false);
    }
  }
  if (cell === "sections") {
    expect(can(who, action, subject)).toBe(false);
    expect(can(who, action, { ...subject, section: "medications" })).toBe(true);
    expect(can(who, action, { ...subject, section: "tasks" })).toBe(false);
  }
}

describe("permissions grid", () => {
  test("every role and every action has one cell", () => {
    expect([...ROLES].sort()).toEqual(Object.keys(GRID).sort());
    for (const role of ROLES) {
      expect(Object.keys(GRID[role]).sort(), role).toEqual([...ACTIONS].sort());
    }
  });

  test("each cell means what it says", () => {
    for (const role of ROLES) {
      for (const action of ACTIONS) expectCell(role, action, GRID[role][action]);
    }
  });

  test("an unknown action is denied", () => {
    expect(can(caregiver("owner"), "not-a-real-action" as Action, { circleId: CIRCLE })).toBe(false);
  });

  test("a caregiver with no role in this circle is denied", () => {
    const unsigned: Actor = { kind: "caregiver", userId: "user-owner", circleIds: [CIRCLE], role: null, accessToken: "token" };
    expect(can(unsigned, "circle:delete", { circleId: CIRCLE })).toBe(false);
  });

  test("a helper cannot act on a different circle", () => {
    expect(can(helper("family"), "summary:read", { circleId: OTHER })).toBe(false);
  });

  test("hiding an area removes that access", () => {
    const aide = helper("home_aide", { hidden: ["medications"], handoffSections: ["medications"] });
    expect(can(aide, "medications:read", { circleId: CIRCLE })).toBe(false);
    expect(can(aide, "medications:print", { circleId: CIRCLE })).toBe(false);
    expect(can(aide, "summary:read", { circleId: CIRCLE })).toBe(true);
  });

  test("a members override can only narrow the list", () => {
    const family = helper("family", { members: "off" });
    expect(can(family, "members:read", { circleId: CIRCLE })).toBe(false);
    expect(can(family, "members:manage", { circleId: CIRCLE })).toBe(false);
    const named = helper("home_aide", { members: "caregivers" });
    expect(can(named, "members:read", { circleId: CIRCLE })).toBe(false);
    expect(can(named, "members:read:caregivers", { circleId: CIRCLE })).toBe(true);
  });

  test("the spec's sharp edges stay put", () => {
    expect(can(caregiver("owner"), "circle:delete", { circleId: CIRCLE })).toBe(true);
    expect(can(stranger, "circle:delete", { circleId: CIRCLE })).toBe(false);
    expect(can(caregiver("owner"), "circle:rotate_key", { circleId: CIRCLE })).toBe(true);
    expect(can(stranger, "circle:rotate_key", { circleId: CIRCLE })).toBe(false);
    expect(can(helper("family"), "circle:rotate_key", { circleId: CIRCLE })).toBe(false);
    expect(can(helper("home_aide"), "circle:rotate_key", { circleId: CIRCLE })).toBe(false);
    expect(can(caregiver("owner"), "export:download", { circleId: CIRCLE })).toBe(true);
    expect(can(stranger, "export:download", { circleId: CIRCLE })).toBe(false);
    expect(can(helper("family"), "updates:post", { circleId: CIRCLE })).toBe(true);
    expect(can(helper("care_manager"), "updates:read", { circleId: CIRCLE })).toBe(true);
    expect(can(helper("care_manager"), "updates:read:family", { circleId: CIRCLE })).toBe(false);
    expect(can(helper("home_aide"), "updates:read", { circleId: CIRCLE })).toBe(false);
    expect(can(helper("day_program"), "medications:print", { circleId: CIRCLE })).toBe(true);
    expect(can(caregiver("owner"), "medications:print", { circleId: CIRCLE })).toBe(false);
    expect(can(helper("home_aide"), "documents:read:legal", { circleId: CIRCLE })).toBe(false);
    expect(can(helper("home_aide"), "documents:read:care", { circleId: CIRCLE })).toBe(true);
    expect(can(helper("family"), "tasks:claim", { circleId: CIRCLE })).toBe(true);
    expect(can(helper("care_manager"), "tasks:claim", { circleId: CIRCLE })).toBe(false);
  });

  test("visit notes: everyone reads what to watch for; the summary and questions stop at family and care managers", () => {
    for (const role of ["family", "care_manager", "home_aide", "day_program"] as const) {
      expect(can(helper(role), "visits:read", { circleId: CIRCLE }), role).toBe(true);
      expect(can(helper(role), "visits:edit", { circleId: CIRCLE }), role).toBe(false);
    }
    expect(can(helper("family"), "visits:read:summary", { circleId: CIRCLE })).toBe(true);
    expect(can(helper("care_manager"), "visits:read:summary", { circleId: CIRCLE })).toBe(true);
    expect(can(helper("home_aide"), "visits:read:summary", { circleId: CIRCLE })).toBe(false);
    expect(can(helper("day_program"), "visits:read:summary", { circleId: CIRCLE })).toBe(false);
    expect(can(caregiver("owner"), "visits:edit", { circleId: CIRCLE })).toBe(true);
    expect(can(stranger, "visits:read", { circleId: CIRCLE })).toBe(false);
    // The caregiver can hide visit notes from one person; that takes away all of it.
    const hidden = helper("family", { hidden: ["handoff"] });
    expect(can(hidden, "visits:read", { circleId: CIRCLE })).toBe(false);
    expect(can(hidden, "visits:read:summary", { circleId: CIRCLE })).toBe(false);
    expect(can(hidden, "medications:read", { circleId: CIRCLE })).toBe(true);
  });
});

describe("saving a link to an account", () => {
  test("every person in the circle may save their own link; the caregiver has nothing to save", () => {
    for (const role of ROLES) expect(can(actor(role), "account:save:own", { circleId: CIRCLE }), role).toBe(role !== "owner");
    expect(can(actor("family"), "account:save:own", { circleId: OTHER })).toBe(false);
    expect(can(stranger, "account:save:own", { circleId: CIRCLE })).toBe(false);
    // Got it on the first-open welcome: everyone in the circle but its caregiver, only in their own circle.
    for (const role of ROLES) expect(can(actor(role), "welcome:done:own", { circleId: CIRCLE }), role).toBe(role !== "owner");
    expect(can(actor("home_aide"), "welcome:done:own", { circleId: OTHER })).toBe(false);
    expect(can(stranger, "welcome:done:own", { circleId: CIRCLE })).toBe(false);
  });

  test("hiding areas does not stop it, and only the owner can undo it", () => {
    expect(can(helper("home_aide", { hidden: ["summary", "medications", "tasks", "calendar"], members: "off" }), "account:save:own", { circleId: CIRCLE })).toBe(true);
    for (const role of ROLES) expect(can(actor(role), "members:manage", { circleId: CIRCLE }), role).toBe(role === "owner");
  });
});

describe("phone numbers and the Emergency page", () => {
  test("everyone in the circle can open the Emergency page and set their own number", () => {
    for (const role of ROLES) {
      expect(can(actor(role), "emergency:read", { circleId: CIRCLE }), role).toBe(true);
      expect(can(actor(role), "phone:edit:own", { circleId: CIRCLE }), role).toBe(true);
    }
    expect(can(actor("family"), "emergency:read", { circleId: OTHER })).toBe(false);
    expect(can(stranger, "emergency:read", { circleId: CIRCLE })).toBe(false);
    expect(can(stranger, "phone:edit:own", { circleId: CIRCLE })).toBe(false);
  });

  test("other people's numbers follow the People list; only the owner changes them", () => {
    expect(can(actor("family"), "members:read", { circleId: CIRCLE })).toBe(true);
    expect(can(actor("care_manager"), "members:read", { circleId: CIRCLE })).toBe(true);
    expect(can(actor("home_aide"), "members:read", { circleId: CIRCLE })).toBe(false);
    expect(can(actor("day_program"), "members:read", { circleId: CIRCLE })).toBe(false);
    for (const role of ROLES) expect(can(actor(role), "members:read:caregivers", { circleId: CIRCLE }), role).toBe(true);
    for (const role of ROLES) expect(can(actor(role), "members:manage", { circleId: CIRCLE }), role).toBe(role === "owner");
  });

  test("hiding the care summary hides the contacts and allergies, not the page", () => {
    const hidden = helper("family", { hidden: ["summary"] });
    expect(can(hidden, "emergency:read", { circleId: CIRCLE })).toBe(true);
    expect(can(hidden, "summary:read", { circleId: CIRCLE })).toBe(false);
    expect(can(helper("family", { members: "off" }), "members:read:caregivers", { circleId: CIRCLE })).toBe(false);
    expect(can(helper("family", { members: "off" }), "phone:edit:own", { circleId: CIRCLE })).toBe(true);
  });
});

