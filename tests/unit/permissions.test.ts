import { describe, expect, test } from "vitest";
import type { Actor } from "@/lib/auth";
import { ACTIONS, GRID, ROLES, can, type Action, type Cell, type Role } from "@/lib/permissions";
import type { HelperRole, Visibility } from "@/lib/schema/circles";

const CIRCLE = "22222222-2222-4222-8222-222222222222";
const OTHER = "33333333-3333-4333-8333-333333333333";

function caregiver(role: "owner" | "co_caregiver"): Actor {
  return { kind: "caregiver", userId: `user-${role}`, circleIds: [CIRCLE], role, accessToken: "token" };
}

function helper(role: HelperRole, visibility: Visibility = { handoffSections: ["medications"] }): Actor {
  return { kind: "helper", memberId: `member-${role}`, circleId: CIRCLE, role, visibility };
}

function actor(role: Role): Actor {
  if (role === "owner" || role === "co_caregiver") return caregiver(role);
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
    expect(can(caregiver("co_caregiver"), "circle:delete", { circleId: CIRCLE })).toBe(false);
    expect(can(caregiver("owner"), "circle:rotate_key", { circleId: CIRCLE })).toBe(true);
    expect(can(caregiver("co_caregiver"), "circle:rotate_key", { circleId: CIRCLE })).toBe(false);
    expect(can(helper("family"), "circle:rotate_key", { circleId: CIRCLE })).toBe(false);
    expect(can(helper("home_aide"), "circle:rotate_key", { circleId: CIRCLE })).toBe(false);
    expect(can(caregiver("owner"), "export:download", { circleId: CIRCLE })).toBe(true);
    expect(can(caregiver("co_caregiver"), "export:download", { circleId: CIRCLE })).toBe(false);
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
});
