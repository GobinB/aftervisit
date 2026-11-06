import "server-only";
import { cookies, headers } from "next/headers";
import { safeNext } from "@/lib/safe-next";
import { createAuthClient } from "./session";

/** Set when sign-in began in the installed iPhone app, so the callback can hand back to it. */
export const APP_SIGN_IN_COOKIE = "av_app";

/** The site's own address: the configured one, or the one this request came in on. */
export async function siteOrigin(): Promise<string> {
  const configured = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
  if (configured) return configured;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

/**
 * Starts Google sign-in and returns Google's address. Default scopes only; Google returns to /callback.
 * The return address and the "began in the app" mark live in short cookies, never in Google's URL.
 * Throws when auth is not set up.
 */
export async function startGoogleSignIn(nextRaw: string, fromApp: boolean): Promise<string | null> {
  const origin = await siteOrigin();
  const next = safeNext(nextRaw, origin);
  const jar = await cookies();
  const short = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge: 600 };
  jar.set("av_next", next, short);
  if (fromApp) jar.set(APP_SIGN_IN_COOKIE, "1", short);
  else jar.delete(APP_SIGN_IN_COOKIE);
  const supabase = await createAuthClient();
  const { data, error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${origin}/callback` } });
  if (error || !data.url) return null;
  return data.url;
}
