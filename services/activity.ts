import "server-only";
import type { Actor } from "@/lib/auth";
import { can } from "@/lib/permissions";
import type { ActivityRow } from "@/lib/today";
import { clientFor } from "@/store/db";

/** The circle's newest activity rows. Only the caregiver who runs the circle sees them. */
export async function listActivity(actor: Actor, circleId: string, limit = 20): Promise<ActivityRow[]> {
  if (actor.kind !== "caregiver" || !can(actor, "members:manage", { circleId })) return [];
  const { data, error } = await clientFor(actor)
    .from("activity")
    .select("id, action, subject_id, at")
    .eq("circle_id", circleId)
    .order("at", { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return data.map((row) => ({ id: row.id as string, action: row.action as string, subjectId: (row.subject_id as string | null) ?? null, at: row.at as string }));
}
