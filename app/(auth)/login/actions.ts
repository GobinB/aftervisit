"use server";

import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { safeNext } from "@/lib/safe-next";
import { createAuthClient } from "../session";

/** One Google button. Default scopes only. redirectTo is the site origin plus /callback. */
export async function signInWithGoogle(formData: FormData) {
  const configured = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
  let origin = configured;
  if (!origin) {
    const { headers } = await import("next/headers");
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
    const proto = h.get("x-forwarded-proto") ?? "http";
    origin = `${proto}://${host}`;
  }
  const redirectTo = `${origin}/callback`;
  const next = safeNext(String(formData.get("next") ?? ""), origin);
  try {
    const jar = await cookies();
    jar.set("av_next", next, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 600,
    });
    const supabase = await createAuthClient();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
    if (error || !data.url) redirect("/login?error=google");
    redirect(data.url);
  } catch (error) {
    if (typeof error === "object" && error && "digest" in error) throw error;
    redirect("/login?error=config");
  }
}

/** Ends the caregiver session on this device only. Other devices stay signed in. */
export async function signOut() {
  try {
    const supabase = await createAuthClient();
    await supabase.auth.signOut({ scope: "local" });
  } catch {
    // Nothing to end when auth is not set up.
  }
  redirect("/");
}
