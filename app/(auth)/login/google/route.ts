import { NextResponse, type NextRequest } from "next/server";
import { startGoogleSignIn } from "../../oauth";

export const dynamic = "force-dynamic";

/**
 * Google sign-in opened in a window of the installed iPhone app. On iOS a window the app opens
 * itself keeps the app's own cookies, so the session lands in the app rather than in Safari.
 * The PKCE secret is set here, in that same window, and read back by /callback.
 */
export async function GET(request: NextRequest) {
  const next = request.nextUrl.searchParams.get("next") ?? "";
  const fromApp = request.nextUrl.searchParams.get("app") === "1";
  let url: string | null;
  try {
    url = await startGoogleSignIn(next, fromApp);
  } catch {
    return NextResponse.redirect(new URL("/login?error=config", request.url));
  }
  const response = NextResponse.redirect(url ?? new URL("/login?error=google", request.url));
  response.headers.set("Cache-Control", "no-store");
  return response;
}
