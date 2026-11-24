import "server-only";
import { cookies } from "next/headers";
import type { Actor } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { readWelcomed, WELCOMED_COOKIE } from "@/lib/welcome";

/** True for a person in the circle who has not tapped Got it on the welcome on this device. */
export async function needsWelcome(actor: Actor): Promise<boolean> {
  if (actor.kind !== "helper" || !can(actor, "welcome:done:own", { circleId: actor.circleId })) return false;
  const jar = await cookies();
  return !readWelcomed(jar.get(WELCOMED_COOKIE)?.value).includes(actor.memberId);
}
