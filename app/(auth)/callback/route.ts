import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createAuthClient } from "../session";

export const dynamic = "force-dynamic";

function safeNext(value: string | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/circles";
  return value;
}

/** Exchanges the Google code for a session. No email is sent. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const jar = await cookies();
  const next = safeNext(jar.get("av_next")?.value);
  jar.delete("av_next");
  if (!code) return NextResponse.redirect(new URL("/login?error=google", url.origin));
  try {
    const supabase = await createAuthClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return NextResponse.redirect(new URL("/login?error=google", url.origin));
  } catch {
    return NextResponse.redirect(new URL("/login?error=config", url.origin));
  }
  return NextResponse.redirect(new URL(next, url.origin));
}
