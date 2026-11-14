import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "@/components/PageShell";
import { PRIVACY_EMAIL } from "@/lib/contact";

export const metadata: Metadata = { title: "Health data notice" };

const EFFECTIVE = "November 13, 2026";

/**
 * Consumer health data privacy notice, for Washington's My Health My Data Act and the similar laws in
 * Nevada and Connecticut. It is its own page, linked from every page's footer, as those laws expect.
 */
export default function HealthDataPage() {
  const mail = (
    <a className="text-primary-700 underline" href={`mailto:${PRIVACY_EMAIL}`}>
      {PRIVACY_EMAIL}
    </a>
  );
  return (
    <PageShell>
      <main id="main" className="flex-1 overflow-x-clip bg-white">
        <div className="mx-auto max-w-[760px] px-4 py-12 sm:px-6 [&_h2]:font-display [&_h2]:mt-9 [&_h2]:text-[1.4rem] [&_h2]:text-primary-900 [&_li]:mt-1.5 [&_p]:mt-2 [&_ul]:mt-2 [&_ul]:list-disc [&_ul]:pl-5">
          <p className="text-[12px] font-semibold tracking-[0.14em] text-attn-ink uppercase">Privacy</p>
          <h1 className="font-display mt-2 text-[2.2rem] leading-tight text-primary-900">Health data notice</h1>
          <p className="text-[14px] text-ink-500">
            For people in Washington, Nevada and Connecticut, and anyone who wants the detail. Effective {EFFECTIVE}. Our full{" "}
            <Link className="text-primary-700 underline" href="/privacy">
              privacy policy
            </Link>{" "}
            applies too.
          </p>

          <h2>The health information we hold</h2>
          <ul>
            <li>Allergies, medicines (with doses, schedules and changes), and what each one is for.</li>
            <li>Doctors, pharmacy, emergency contacts and appointments.</li>
            <li>What an after-visit summary says: medicine changes, next steps, warning signs, follow-up visits.</li>
            <li>Photos or PDFs of after-visit summaries, if you choose to keep them.</li>
            <li>Reminders and calendar entries about care.</li>
          </ul>

          <h2>Where it comes from</h2>
          <ul>
            <li>You, the caregiver: what you type, choose, scan or keep.</li>
            <li>The people you add, through their link: for example, marking a reminder done or saying they will go to an appointment.</li>
          </ul>

          <h2>Why we use it</h2>
          <p>
            Only to run your care circle: to show it to you and to the people you choose, to turn a visit summary into a draft you check,
            and to keep the circle safe. We never use it for ads, never sell it, and never use it to build profiles.
          </p>

          <h2>Who it is shared with</h2>
          <ul>
            <li>The people you add, and only the parts you let them see. You choose this for each person.</li>
            <li>
              Companies that run the service for us, and only for that: Vercel (hosting), Supabase (database and private file storage) and
              Google (sign-in, which sees your account, not your circle).
            </li>
            <li>
              If you choose to add the calendar link to Google Calendar, Apple Calendar or Outlook: that company, which receives
              appointments and reminders (not medicines).
            </li>
            <li>No one else, unless the law requires it. We do not sell health information.</li>
          </ul>

          <h2>Saved photos and PDFs</h2>
          <p>
            If you keep the photos or PDF of a visit summary, they are encrypted on your device before they are sent, so what is stored is
            scrambled. All Hands Care keeps the key and hands it to you after you sign in, which is why they open on any device. That means
            we are technically able to open them. In the app they are shown only to you, the caregiver: the people you add cannot see them.
          </p>

          <h2>Your rights</h2>
          <ul>
            <li>See the health information we hold, and the list of everyone it has been shared with.</li>
            <li>Have it deleted, including from backups within 7 days.</li>
            <li>Withdraw your agreement to our holding it, by deleting the circle.</li>
          </ul>
          <p>
            Email {mail}. We check the request comes from you and answer within 45 days, at no charge. If we say no, reply to ask us to
            look again; we answer within 45 days. If you live in Washington and we still say no, you can complain to the Washington State
            Attorney General.
          </p>

          <h2>Contact</h2>
          <p>{mail}</p>
        </div>
      </main>
    </PageShell>
  );
}
