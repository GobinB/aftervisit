import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { safeNext } from "@/lib/safe-next";
import { APP_SIGN_IN_COOKIE } from "../oauth";
import { createAuthClient } from "../session";

export const dynamic = "force-dynamic";

/**
 * Exchanges the Google code for a session. No email is sent.
 * When sign-in began in the installed iPhone app, it finishes on /login/done, which tells the
 * app's main window and closes the sign-in window.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const jar = await cookies();
  const next = safeNext(jar.get("av_next")?.value, url.origin);
  const fromApp = jar.get(APP_SIGN_IN_COOKIE)?.value === "1";
  jar.delete("av_next");
  jar.delete(APP_SIGN_IN_COOKIE);
  if (!code) return NextResponse.redirect(new URL("/login?error=google", url.origin));
  try {
    const supabase = await createAuthClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return NextResponse.redirect(new URL("/login?error=google", url.origin));
  } catch {
    return NextResponse.redirect(new URL("/login?error=config", url.origin));
  }
  const target = fromApp ? `/login/done?next=${encodeURIComponent(next)}` : next;
  return NextResponse.redirect(new URL(target, url.origin));
}
