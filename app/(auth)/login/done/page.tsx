import type { Metadata } from "next";
import { headers } from "next/headers";
import { safeNext } from "@/lib/safe-next";
import { SignedIn } from "./SignedIn";

export const metadata: Metadata = { title: "Signed in", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** The end of a sign-in that began in the installed iPhone app. */
export default async function SignedInPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const query = await searchParams;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  return <SignedIn next={safeNext(query.next, `${proto}://${host}`)} />;
}
