import { z } from "zod";

/** Who a to-do is for: nobody yet, the caregiver, or one person with a link (their member id). */
export const AssigneeSchema = z.union([z.literal("none"), z.literal("caregiver"), z.string().uuid()]);

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value ? value : undefined));

export const TodoInputSchema = z
  .object({
    circleId: z.string().uuid(),
    id: z.string().uuid().optional(),
    title: z.string().trim().min(1, "Write what needs doing.").max(200),
    note: optionalText(1000),
    dueDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional()
      .or(z.literal("").transform(() => undefined)),
    assignee: AssigneeSchema.default("none"),
  })
  .strict();
export type TodoInput = z.infer<typeof TodoInputSchema>;

export const TodoChangeSchema = z.object({ circleId: z.string().uuid(), id: z.string().uuid() }).strict();
export const TodoDoneSchema = TodoChangeSchema.extend({ done: z.boolean() }).strict();

export type Todo = {
  id: string;
  title: string;
  note: string | null;
  dueDate: string | null;
  assignee: { kind: "caregiver" } | { kind: "member"; memberId: string } | null;
  status: "open" | "done";
  doneAt: string | null;
  createdAt: string;
};

export const TODO_VIEWS = ["open", "mine", "volunteer", "done"] as const;
export type TodoView = (typeof TODO_VIEWS)[number];
export const TODO_VIEW_LABELS: Record<TodoView, string> = { open: "Open", mine: "Mine", volunteer: "Needs a volunteer", done: "Done" };

/** Whether a to-do belongs to the person looking at it. */
export function isMine(todo: Todo, viewer: { kind: "caregiver" } | { kind: "member"; memberId: string }): boolean {
  if (!todo.assignee) return false;
  if (viewer.kind === "caregiver") return todo.assignee.kind === "caregiver";
  return todo.assignee.kind === "member" && todo.assignee.memberId === viewer.memberId;
}

/** Open to-dos with a due date come first (soonest first), then undated ones, newest first. Done ones, newest done first. */
export function sortTodos(todos: Todo[]): Todo[] {
  return [...todos].sort((a, b) => {
    if (a.status !== b.status) return a.status === "open" ? -1 : 1;
    if (a.status === "done") return (b.doneAt ?? "").localeCompare(a.doneAt ?? "");
    if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
    if (a.dueDate) return -1;
    if (b.dueDate) return 1;
    return b.createdAt.localeCompare(a.createdAt);
  });
}

export function filterTodos(todos: Todo[], view: TodoView, viewer: { kind: "caregiver" } | { kind: "member"; memberId: string }): Todo[] {
  switch (view) {
    case "open":
      return todos.filter((todo) => todo.status === "open");
    case "mine":
      return todos.filter((todo) => todo.status === "open" && isMine(todo, viewer));
    case "volunteer":
      return todos.filter((todo) => todo.status === "open" && !todo.assignee);
    case "done":
      return todos.filter((todo) => todo.status === "done");
  }
}

/** yyyy-mm-dd in the viewer's own day. */
export function localToday(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
