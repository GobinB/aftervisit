import { NextResponse, type NextRequest } from "next/server";
import { homePath } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** The installed app's start page. It sends each person to their own screen. */
export async function GET(request: NextRequest) {
  const response = NextResponse.redirect(new URL(await homePath(), request.url));
  response.headers.set("Cache-Control", "no-store");
  return response;
}
