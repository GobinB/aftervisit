import { GoogleButton } from "@/app/(auth)/login/GoogleButton";

/**
 * A person's link after they saved it to their Google account: it opens only for that account, so a
 * forwarded link shows this instead of the circle. `other` is set when someone is signed in with a
 * different account; their own address is the only one shown.
 */
export function LinkNeedsSignIn({ next, other }: { next: string; other: { email: string | null } | null }) {
  return (
    <div className="mx-auto w-full max-w-md rounded-2xl border border-border-200 bg-white p-6 text-center">
      <h1 className="font-display text-section text-primary-900">Sign in to open this circle</h1>
      <p className="mt-2 text-ink-500">This link is saved to a Google account. Sign in with that account to open it.</p>
      {other ? (
        <p role="alert" className="mt-4 rounded-xl bg-attn-bg px-3 py-2 text-left text-attn-ink">
          {other.email ? (
            <>
              You are signed in as <strong className="break-all">{other.email}</strong>.
            </>
          ) : (
            "You are signed in with a different Google account."
          )}{" "}
          This link opens only for the account it was saved to.
        </p>
      ) : null}
      <GoogleButton next={next} label={other ? "Use another Google account" : "Sign in with Google"} chooseAccount={Boolean(other)} className="mt-6" />
      <p className="mt-5 text-left text-[14px] text-ink-500">
        No longer have that account, or this link is not yours? Ask the caregiver who runs the circle. They can undo it on their People page, and the link opens on its own again.
      </p>
    </div>
  );
}
