"use server";

import "server-only";
import { redirect } from "next/navigation";
import { startGoogleSignIn } from "../oauth";
import { createAuthClient } from "../session";

/** One Google button. Default scopes only. redirectTo is the site origin plus /callback. */
export async function signInWithGoogle(formData: FormData) {
  let url: string | null;
  try {
    url = await startGoogleSignIn(String(formData.get("next") ?? ""), false);
  } catch {
    redirect("/login?error=config");
  }
  if (!url) redirect("/login?error=google");
  redirect(url);
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
