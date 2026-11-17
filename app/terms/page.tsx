import type { Metadata } from "next";
import Link from "next/link";
import { SOURCE_URL } from "@/components/AppBar";
import { PageShell } from "@/components/PageShell";
import { ADMIN_EMAIL, PRIVACY_EMAIL } from "@/lib/contact";
import { TERMS_EFFECTIVE } from "@/lib/schema/circles";

export const metadata: Metadata = { title: "Terms of use" };

/**
 * The terms a caregiver agrees to when they start a circle (the "terms" consent). Plain words, short
 * sections. If this page changes in a way that matters, change TERMS_EFFECTIVE, which also changes
 * the consent version saved with each new circle.
 */
export default function TermsPage() {
  const mail = (address: string) => (
    <a className="text-primary-700 underline" href={`mailto:${address}`}>
      {address}
    </a>
  );
  return (
    <PageShell>
      <main id="main" className="flex-1 overflow-x-clip bg-white">
        <div className="mx-auto max-w-[760px] px-4 py-12 sm:px-6 [&_h2]:font-display [&_h2]:mt-9 [&_h2]:text-[1.4rem] [&_h2]:text-primary-900 [&_li]:mt-1.5 [&_p]:mt-2 [&_ul]:mt-2 [&_ul]:list-disc [&_ul]:pl-5">
          <p className="text-[12px] font-semibold tracking-[0.14em] text-attn-ink uppercase">Terms</p>
          <h1 className="font-display mt-2 text-[2.2rem] leading-tight text-primary-900">Terms of use</h1>
          <p className="text-[14px] text-ink-500">
            Effective {TERMS_EFFECTIVE}. These are the rules for using All Hands Care. Our{" "}
            <Link className="text-primary-700 underline" href="/privacy">
              privacy policy
            </Link>{" "}
            says what we keep and who sees it.
          </p>

          <div className="mt-6 rounded-xl border border-attn-ink/30 bg-attn-bg p-4 text-ink-900">
            <p className="!mt-0 font-semibold">The short version</p>
            <ul>
              <li>All Hands Care is not for emergencies. If someone is in danger, call 911.</li>
              <li>It does not give medical advice. Follow what the doctor, nurse or pharmacist tells you.</li>
              <li>Check what it reads from a visit summary against the paper. It can get things wrong.</li>
              <li>Only add someone&apos;s care information if you are allowed to.</li>
              <li>A person&apos;s link opens their part of the circle. Send it only to them.</li>
            </ul>
          </div>

          <h2>What All Hands Care is</h2>
          <p>
            All Hands Care is a free, shared care page for an older adult and the people who help them: medicines, appointments, reminders,
            emergency contacts and notes from visits. The caregiver who starts a circle signs in with Google and chooses who else can see
            each part. The people they add open their own link, no account needed, and can sign in with Google if they want all their
            circles in one place. It is new and still changing, so some things may not work as they should. Its code is open source, under the
            AGPL-3.0 license.
          </p>

          <h2>Not medical advice, and not for emergencies</h2>
          <p>
            All Hands Care organizes what you and the clinician wrote. It does not diagnose, treat or advise, and it does not check whether
            a medicine, dose or plan is right. It is not a medical record, and it does not replace talking to a doctor, nurse or
            pharmacist. If you are unsure about a medicine or an instruction, ask them.
          </p>
          <p>
            Nobody at All Hands Care watches your circle, and it does not send alerts. The site or the calendar link can be slow or out of
            date, so do not rely on them alone for something that must not be missed. In an emergency, call 911.
          </p>

          <h2>Visit summaries are read for you, and you check them</h2>
          <p>
            When you add a visit summary, All Hands Care reads it and makes a draft: medicine changes, next steps and the rest. Reading can
            go wrong, especially with a blurry photo or handwriting. Nothing is saved until you have checked the draft against the
            original and confirmed it. You are responsible for what you confirm and share.
          </p>

          <h2>Who can use it</h2>
          <ul>
            <li>You must be 18 or older.</li>
            <li>
              You may add someone&apos;s care information only if you are that person, or they or their legal representative have
              allowed you to. You confirm this when you start a circle.
            </li>
            <li>The people you add use All Hands Care through their link, and these terms apply to them too.</li>
          </ul>

          <h2>Keep links and your account safe</h2>
          <p>
            Each person you add gets a private link. Anyone who has that link can open what it shows, so send it only to that person. If a
            link is lost or sent to the wrong person, open People and make a new link: the old one stops working at once. Keep your Google
            account secure, because it opens everything in your circles. If you saved your own link to your Google account, it opens only
            when you are signed in with that account.
          </p>

          <h2>What you must not do</h2>
          <ul>
            <li>Add information about someone without the right to, or use All Hands Care to harm, harass or watch anyone.</li>
            <li>Try to see circles or links that are not yours, get around the sign-in or limits, or break the site.</li>
            <li>Put in anything unlawful, or use All Hands Care to send spam or advertising.</li>
          </ul>
          <p>
            Found a security problem? Please tell us at {mail(ADMIN_EMAIL)} and do not use it. Our{" "}
            <a className="text-primary-700 underline" href={`${SOURCE_URL}/blob/main/SECURITY.md`} target="_blank" rel="noreferrer">
              security policy
            </a>{" "}
            says how.
          </p>

          <h2>Your information stays yours</h2>
          <p>
            What you put in All Hands Care belongs to you. You let us store it and show it to you and to the people you choose, only to run
            the service. We do not sell it or use it for advertising. The{" "}
            <Link className="text-primary-700 underline" href="/privacy">
              privacy policy
            </Link>{" "}
            has the details.
          </p>

          <h2>Ending</h2>
          <p>
            You can delete a circle at any time from its Settings; it closes at once and is erased for good after 30 days. We may close a
            circle or an account that breaks these terms or puts others at risk. If we ever stop running All Hands Care, we will tell
            caregivers at least 30 days before, so there is time to print or copy what you need.
          </p>

          <h2>No promises, and limits</h2>
          <p>
            All Hands Care is free and is provided as it is, without promises that it will always be available, free of mistakes, or right
            for your needs. As far as the law allows, All Hands Care and the people who build it are not responsible for harm that comes
            from using it or not being able to use it, including from a missed reminder, a wrong reading of a visit summary, or a decision
            about care. Some places do not allow some of these limits, so they may not all apply to you.
          </p>

          <h2>Changes to these terms</h2>
          <p>
            If these terms change, we will update the date at the top. Before a change that matters, we will show a notice in the app.
            Using All Hands Care after a change means you accept the new terms.
          </p>
          <p>
            <strong>Latest change, {TERMS_EFFECTIVE}:</strong> the people a caregiver adds can now sign in with Google if they choose, to
            keep all their circles in one place. Signing in is never required. When they do, these terms apply to that account too, and we
            keep their Google name and email, as the{" "}
            <Link className="text-primary-700 underline" href="/privacy">
              privacy policy
            </Link>{" "}
            says. Before, only caregivers signed in.
          </p>

          <h2>The law that applies</h2>
          <p>These terms are governed by the laws of Kentucky, in the United States.</p>

          <h2>Contact us</h2>
          <p>
            Questions about these terms: {mail(ADMIN_EMAIL)}. Questions or requests about privacy: {mail(PRIVACY_EMAIL)}.
          </p>
        </div>
      </main>
    </PageShell>
  );
}
