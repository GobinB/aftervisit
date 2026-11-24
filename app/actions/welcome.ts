"use server";

import "server-only";
import { cookies } from "next/headers";
import { z } from "zod";
import { getActor } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { secureCookies } from "@/lib/session-cookie";
import { addWelcomed, WELCOMED_COOKIE } from "@/lib/welcome";

const Input = z.object({ circleId: z.string().uuid() });

/** Got it on the welcome: remembered on this device for a year. */
export async function welcomeDoneAction(input: unknown): Promise<{ ok: boolean }> {
  const parsed = Input.safeParse(input);
  if (!parsed.success) return { ok: false };
  const actor = await getActor(parsed.data.circleId);
  if (!actor || actor.kind !== "helper" || !can(actor, "welcome:done:own", { circleId: parsed.data.circleId })) return { ok: false };
  const jar = await cookies();
  jar.set(WELCOMED_COOKIE, addWelcomed(jar.get(WELCOMED_COOKIE)?.value, actor.memberId), {
    httpOnly: true,
    sameSite: "lax",
    secure: secureCookies(),
    path: "/",
    maxAge: 365 * 24 * 60 * 60,
  });
  return { ok: true };
}
