import { NextResponse } from "next/server";
import { getActor } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Whether this browser holds a caregiver session. Used by the sign-in page in the installed app. */
export async function GET() {
  const actor = await getActor();
  return NextResponse.json({ signedIn: actor?.kind === "caregiver" }, { headers: { "Cache-Control": "no-store" } });
}
