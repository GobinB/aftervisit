/**
 * Whether the site's cookies are marked Secure (sent over https only). On for every production
 * build. The end-to-end tests run a production build on http://localhost, where WebKit (the iPhone
 * test browser) refuses Secure cookies, so they set E2E_INSECURE_COOKIES=1 in playwright.config.ts.
 * That flag is refused on any hosted deployment: a deployed site with it set fails loudly here.
 */
export function secureCookies(vars: Record<string, string | undefined> = process.env): boolean {
  if (vars.E2E_INSECURE_COOKIES === "1") {
    if (vars.VERCEL || vars.VERCEL_ENV) throw new Error("E2E_INSECURE_COOKIES is for local end-to-end tests only and must never be set on a deployment.");
    return false;
  }
  return vars.NODE_ENV === "production";
}

/**
 * How the caregiver's sign-in cookies are stored. httpOnly keeps page scripts (and so any injected
 * script) from reading the session. Nothing in the browser needs it: every Supabase call runs on
 * the server. Supabase's own default of 400 days is kept, renewed on each visit.
 */
export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: secureCookies(),
  path: "/",
};
