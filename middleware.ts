import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refreshes the caregiver session cookie. Helper cookies are checked in getActor.
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

  const url = process.env.SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
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
  await supabase.auth.getUser();
  return supabaseResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
