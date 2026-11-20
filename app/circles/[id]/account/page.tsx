import { CheckCircle2, ShieldCheck, UsersRound } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { GoogleButton } from "@/app/(auth)/login/GoogleButton";
import { PageHead } from "@/components/circles/PageHead";
import { SaveToAccount } from "@/components/circles/SaveToAccount";
import { buttonClass } from "@/components/ui/Button";
import { getActor } from "@/lib/auth";
import { getCircle } from "@/services/circles";

export const metadata: Metadata = { title: "Save to my account", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const card = "max-w-xl rounded-2xl border border-border-200 bg-white p-5";

/**
 * A person saves their link to their Google account, so every circle they are in is in one place.
 * Optional: the link keeps working as it is if they never do. It takes their link (already opened on
 * this device) and a Google sign-in; Google brings them back here to confirm.
 */
export default async function SaveToAccountPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [actor, account] = await Promise.all([getActor(id), getActor()]);
  const signedIn = account?.kind === "caregiver" ? account : null;
  const back = { href: `/circles/${id}`, label: "Back to Today" };

  if (!actor) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-surface-50 px-4">
        <div className="mx-auto w-full max-w-md rounded-2xl border border-border-200 bg-white p-6 text-center">
          <h1 className="font-display text-section text-primary-900">Open your link first</h1>
          <p className="mt-2 text-ink-500">To save a circle to your account, open the link you were sent for it on this phone or computer, then tap Save this to my account.</p>
          <Link href="/" className={buttonClass("secondary", "mt-6 w-full")}>
            All Hands Care home
          </Link>
        </div>
      </div>
    );
  }

  const personName = (await getCircle(actor, id))?.person_name ?? "this person";

  if (actor.kind === "caregiver") {
    return (
      <>
        <PageHead back={back} title="Already in your account" />
        <div className={card}>
          <p className="text-ink-900">You run {personName}&apos;s circle, so it is already in your account.</p>
          <Link href="/circles" className={buttonClass("secondary", "mt-4")}>
            All your circles
          </Link>
        </div>
      </>
    );
  }

  if (actor.userId) {
    return (
      <>
        <PageHead back={back} title="Saved to your account" />
        <div className={card}>
          <p className="flex items-start gap-2 text-ink-900">
            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-ok-ink" aria-hidden="true" />
            <span>
              {personName}&apos;s circle is saved to {signedIn?.email ? <strong className="break-all">{signedIn.email}</strong> : "your Google account"}. Sign in with Google on any phone
              or computer to open it.
            </span>
          </p>
          <p className="mt-3 text-[14px] text-ink-500">Your link now opens only when you are signed in with this account.</p>
          <Link href="/circles" className={buttonClass("primary", "mt-5 w-full sm:w-auto")}>
            All your circles
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHead back={back} title="Save this to my account" subtitle="Optional. Your link keeps working as it is if you skip this." />
      <div className={card}>
        <ul className="space-y-3 text-ink-900">
          <li className="flex items-start gap-3">
            <UsersRound className="mt-0.5 size-5 shrink-0 text-primary-700" aria-hidden="true" />
            <span>All your circles in one place. Sign in with Google on any phone or computer to open {personName}&apos;s circle, and any other circle you are in.</span>
          </li>
          <li className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary-700" aria-hidden="true" />
            <span>After you save it, your link opens only for you, when you are signed in. If someone else gets the link, it will not open for them.</span>
          </li>
        </ul>
        <p className="mt-3 text-[14px] text-ink-500">You see the same things as with your link. We keep your Google name and email so the caregiver can see who signed in.</p>
        {signedIn ? (
          <>
            <SaveToAccount circleId={id} email={signedIn.email ?? null} />
            <GoogleButton next={`/circles/${id}/account`} label="Use another Google account" chooseAccount variant="secondary" className="mt-3" />
          </>
        ) : (
          <GoogleButton next={`/circles/${id}/account`} label="Sign in with Google" className="mt-5" />
        )}
      </div>
    </>
  );
}
