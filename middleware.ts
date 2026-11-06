import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { dataEnv } from "@/lib/data-env";

/**
 * Refreshes the caregiver session cookie on every page request, so a caregiver who opens the app
 * now and then stays signed in: Supabase's cookies last 400 days and each refresh renews them.
 * Helper cookies are checked in getActor.
 * When auth env is unset, the public demo keeps working.
 */
export async function middleware(request: NextRequest) {
  // A Google sign-in that Supabase rejects (for example, one left open too long) comes back
  // to the site address with the error only in the query. Show it on the sign-in page.
  const { pathname, searchParams } = request.nextUrl;
  if (pathname === "/" && searchParams.has("error_code")) {
    const target = request.nextUrl.clone();
    target.pathname = "/login";
    target.search = searchParams.get("error_code") === "bad_oauth_state" ? "?error=expired" : "?error=google";
    return NextResponse.redirect(target);
  }

  const { supabaseUrl: url, anonKey: key } = dataEnv();
  if (!url || !key) return NextResponse.next({ request });

  let supabaseResponse = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options));
      },
    },
  });
  // Refreshes an expired session and checks its signature locally against Supabase's public key,
  // without a call to the auth server on every page.
  await supabase.auth.getClaims();
  // Remember which circle was opened last, so the installed app reopens it. Only the id is kept.
  const circle = /^\/circles\/([0-9a-f-]{36})(?:\/|$)/i.exec(pathname)?.[1];
  if (circle && request.cookies.get("ahc_last_circle")?.value !== circle) {
    supabaseResponse.cookies.set("ahc_last_circle", circle, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 400 * 24 * 60 * 60,
    });
  }
  return supabaseResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
