import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { env } from "@/lib/env";
import { SESSION_COOKIE_OPTIONS } from "@/lib/session-cookie";

/**
 * Google sign-in for routes under app/(auth). Same cookie names as store/supabase-server.ts.
 * This file may import @supabase/ssr. It must not import store/.
 */
export async function createAuthClient() {
  if (!env.supabaseUrl || !env.anonKey) throw new Error("Supabase auth is not configured");
  const cookieStore = await cookies();
  return createServerClient(env.supabaseUrl, env.anonKey, {
    cookieOptions: SESSION_COOKIE_OPTIONS,
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // The callback route can set cookies. Render cannot.
        }
      },
    },
  });
}
