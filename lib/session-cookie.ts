/**
 * How the caregiver's sign-in cookies are stored. httpOnly keeps page scripts (and so any injected
 * script) from reading the session. Nothing in the browser needs it: every Supabase call runs on
 * the server. Supabase's own default of 400 days is kept, renewed on each visit.
 */
export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};
