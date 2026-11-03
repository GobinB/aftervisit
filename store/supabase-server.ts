import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { env } from "@/lib/env";

/**
 * Caregiver session for Server Components and server actions.
 * Cookie writes here can fail during render. middleware.ts refreshes the session.
 * Keep the cookie adapter in step with middleware.ts and app/(auth)/session.ts.
 */
export async function createSupabaseServerClient() {
  if (!env.supabaseUrl || !env.anonKey) throw new Error("Supabase auth is not configured");
  const cookieStore = await cookies();
  return createServerClient(env.supabaseUrl, env.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Render cannot set cookies. The middleware refresh already did.
        }
      },
    },
  });
}
