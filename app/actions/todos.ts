"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { getActor } from "@/lib/auth";
import { TodoChangeSchema, TodoDoneSchema, TodoInputSchema } from "@/lib/schema/todos";
import { claimTodo, deleteTodo, saveTodo, setTodoDone } from "@/services/todos";

function refresh(circleId: string) {
  revalidatePath(`/circles/${circleId}`);
  revalidatePath(`/circles/${circleId}/todos`);
}

export async function saveTodoAction(input: unknown) {
  const parsed = TodoInputSchema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { ok: false as const, error: first?.path[0] === "title" ? "Write what needs doing." : "Check the form and try again." };
  }
  const actor = await getActor(parsed.data.circleId);
  if (!actor) return { ok: false as const, error: "Sign in to continue." };
  const result = await saveTodo(actor, parsed.data);
  if (result.ok) refresh(parsed.data.circleId);
  return result;
}

export async function claimTodoAction(input: unknown) {
  const parsed = TodoChangeSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Check the form and try again." };
  const actor = await getActor(parsed.data.circleId);
  if (!actor) return { ok: false as const, error: "Open your link again to continue." };
  const result = await claimTodo(actor, parsed.data.circleId, parsed.data.id);
  refresh(parsed.data.circleId);
  return result;
}

export async function setTodoDoneAction(input: unknown) {
  const parsed = TodoDoneSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Check the form and try again." };
  const actor = await getActor(parsed.data.circleId);
  if (!actor) return { ok: false as const, error: "Open your link again to continue." };
  const result = await setTodoDone(actor, parsed.data.circleId, parsed.data.id, parsed.data.done);
  if (result.ok) refresh(parsed.data.circleId);
  return result;
}

export async function deleteTodoAction(input: unknown) {
  const parsed = TodoChangeSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Check the form and try again." };
  const actor = await getActor(parsed.data.circleId);
  if (!actor) return { ok: false as const, error: "Sign in to continue." };
  const result = await deleteTodo(actor, parsed.data.circleId, parsed.data.id);
  if (result.ok) refresh(parsed.data.circleId);
  return result;
}
