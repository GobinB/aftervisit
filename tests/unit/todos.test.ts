import { beforeEach, describe, expect, test, vi } from "vitest";
import type { Actor } from "@/lib/auth";
import type { PersonView } from "@/lib/schema/circles";
import { TodoInputSchema, filterTodos, sortTodos, type Todo } from "@/lib/schema/todos";
import { buildAlerts, buildFeed, buildTodayCards } from "@/lib/today";
import { todoRows } from "@/lib/todo-rows";

const { clientFor } = vi.hoisted(() => ({ clientFor: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/store/db", () => ({ clientFor }));

import { claimTodo, listTodos, saveTodo, setTodoDone } from "@/services/todos";

const circleId = "22222222-2222-4222-8222-222222222222";
const AIDE_ID = "33333333-3333-4333-8333-333333333301";
const FAMILY_ID = "33333333-3333-4333-8333-333333333302";
const owner: Actor = { kind: "caregiver", userId: "user-owner", circleIds: [circleId], role: "owner", accessToken: "token" };
const aide: Actor = { kind: "helper", memberId: AIDE_ID, circleId, role: "home_aide", visibility: {} };
const family: Actor = { kind: "helper", memberId: FAMILY_ID, circleId, role: "family", visibility: {} };
const manager: Actor = { kind: "helper", memberId: "33333333-3333-4333-8333-333333333303", circleId, role: "care_manager", visibility: {} };

const todo = (fields: Partial<Todo> & Pick<Todo, "id">): Todo => ({
  title: fields.id,
  note: null,
  dueDate: null,
  assignee: null,
  status: "open",
  doneAt: null,
  createdAt: "2026-11-01T10:00:00Z",
  ...fields,
});
const todos: Todo[] = [
  todo({ id: "nobody" }),
  todo({ id: "aide", assignee: { kind: "member", memberId: AIDE_ID }, dueDate: "2026-11-05" }),
  todo({ id: "me", assignee: { kind: "caregiver" }, dueDate: "2026-11-04" }),
  todo({ id: "finished", status: "done", doneAt: "2026-11-02T10:00:00Z" }),
];
const people: PersonView[] = [
  { id: "user-owner", name: "Lisa", role: "owner", roleLabel: "Caregiver", kind: "caregiver" },
  { id: AIDE_ID, name: "Rosa", role: "home_aide", roleLabel: "Home aide", kind: "member", lastSeenAt: null },
];

beforeEach(() => clientFor.mockReset());

describe("to-do lists", () => {
  test("views and order", () => {
    expect(sortTodos(filterTodos(todos, "open", { kind: "caregiver" })).map((t) => t.id)).toEqual(["me", "aide", "nobody"]);
    expect(filterTodos(todos, "mine", { kind: "caregiver" }).map((t) => t.id)).toEqual(["me"]);
    expect(filterTodos(todos, "mine", { kind: "member", memberId: AIDE_ID }).map((t) => t.id)).toEqual(["aide"]);
    expect(filterTodos(todos, "volunteer", { kind: "caregiver" }).map((t) => t.id)).toEqual(["nobody"]);
    expect(filterTodos(todos, "done", { kind: "caregiver" }).map((t) => t.id)).toEqual(["finished"]);
  });

  test("a title is needed, and the assignee is nobody, the caregiver, or a member id", () => {
    expect(TodoInputSchema.safeParse({ circleId, title: " " }).success).toBe(false);
    expect(TodoInputSchema.parse({ circleId, title: "Call" }).assignee).toBe("none");
    expect(TodoInputSchema.safeParse({ circleId, title: "Call", assignee: "Rosa" }).success).toBe(false);
    expect(TodoInputSchema.safeParse({ circleId, title: "Call", assignee: AIDE_ID }).success).toBe(true);
  });

  test("each viewer sees who has it and what they may do", () => {
    const byId = (actor: Actor) => Object.fromEntries(todoRows(actor, circleId, todos, people).map((row) => [row.id, row]));
    const forOwner = byId(owner);
    expect(forOwner.me.ownerLabel).toBe("You");
    expect(forOwner.aide.ownerLabel).toBe("Rosa");
    expect(forOwner.nobody.ownerLabel).toBe("Needs a volunteer");
    expect(forOwner.aide.canToggle).toBe(true);
    const forAide = byId(aide);
    expect(forAide.aide.ownerLabel).toBe("You");
    expect(forAide.aide.canToggle).toBe(true);
    expect(forAide.me.canToggle).toBe(false);
    expect(forAide.nobody.canClaim).toBe(false);
    expect(byId(family).nobody.canClaim).toBe(true);
    expect(byId(family).aide.canToggle).toBe(false);
    expect(byId(manager).nobody.canClaim).toBe(false);
  });
});

describe("to-do permissions in the service", () => {
  test("helpers cannot add to-dos, and a home aide cannot take one", async () => {
    expect((await saveTodo(family, TodoInputSchema.parse({ circleId, title: "Call" }))).ok).toBe(false);
    expect((await claimTodo(aide, circleId, "44444444-4444-4444-8444-444444444444")).ok).toBe(false);
    expect(clientFor).not.toHaveBeenCalled();
  });

  test("a home aide reads only their own to-dos", async () => {
    const eq = vi.fn();
    const chain = { eq, order: () => ({ limit: async () => ({ data: [], error: null }) }) };
    eq.mockReturnValue(chain);
    clientFor.mockReturnValue({ from: () => ({ select: () => chain }) });
    await listTodos(aide, circleId);
    expect(eq).toHaveBeenCalledWith("assignee_member_id", AIDE_ID);
  });

  test("a helper finishing a to-do is limited to their own", async () => {
    const eq = vi.fn();
    const chain = { eq, select: () => ({ maybeSingle: async () => ({ data: { id: "t" }, error: null }) }) };
    eq.mockReturnValue(chain);
    const insert = vi.fn(async () => ({ error: null }));
    clientFor.mockReturnValue({ from: (table: string) => (table === "activity" ? { insert } : { update: () => chain }) });
    expect((await setTodoDone(family, circleId, "t", true)).ok).toBe(true);
    expect(eq).toHaveBeenCalledWith("assignee_member_id", FAMILY_ID);
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ action: "todo_done", actor: `member:${FAMILY_ID}` }));
  });
});

describe("to-dos on Today", () => {
  test("stats, alerts and the feed include to-dos", () => {
    const cards = Object.fromEntries(buildTodayCards(circleId, null, [], todos).map((card) => [card.key, card]));
    expect(cards.reminders.value).toBe(3);
    expect(cards.reminders.detail).toBe("1 needs someone");
    expect(buildAlerts(circleId, people, Date.now(), todos).find((a) => a.key === "volunteer")?.count).toBe(1);
    const feed = buildFeed([{ id: "a", action: "todo_done", subjectId: "aide", at: "2026-11-02T10:00:00Z", actor: `member:${AIDE_ID}` }], people, 8, todos);
    expect(feed[0].title).toBe("Rosa finished: aide");
  });
});
