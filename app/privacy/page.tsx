import type { Metadata } from "next";
import { SOURCE_URL } from "@/components/AppBar";
import { DemoNotice } from "@/components/DemoNotice";
import { PageShell } from "@/components/PageShell";
import { providerDisclosure } from "@/lib/extract/provider";

export const metadata: Metadata = { title: "Privacy" };
export const dynamic = "force-dynamic";

const TTL_DAYS = Number(process.env.HANDOFF_TTL_DAYS || 30);

export default function PrivacyPage() {
  const provider = providerDisclosure();
  return (
    <PageShell>
      <main id="main" className="mx-auto w-full max-w-[720px] flex-1 px-4 pt-10 pb-16">
        <h1 className="font-display text-[2.4rem] leading-tight font-medium text-primary-900">Privacy</h1>
        <p className="mt-3 text-lg text-ink-500">How this site handles information today, in plain language.</p>
        <DemoNotice className="mt-6" />

        <div className="mt-10 space-y-10 [&_h2]:font-display [&_h2]:text-[1.6rem] [&_h2]:text-ink-900 [&_li]:mt-2 [&_p]:mt-2 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-6">
          <section>
            <h2>While you build a draft</h2>
            <ul>
              <li>
                Pasted text and PDFs are sent to AfterVisit&apos;s server to build the draft. They are processed in memory and are not saved.
              </li>
              <li>Photos are read in your browser. The photo is not uploaded; only the text read from it is sent to build the draft.</li>
              <li>
                The draft is built by <strong>{provider.label}</strong>.
                {provider.thirdParty ? (
                  <>
                    {" "}
                    This means the text of your summary is sent from AfterVisit&apos;s server to that service. See its{" "}
                    <a className="text-primary-700 underline" href={provider.termsUrl} target="_blank" rel="noreferrer">
                      terms
                    </a>
                    .
                  </>
                ) : null}
              </li>
              <li>Your draft stays in this browser tab until you create a handoff or close the tab.</li>
            </ul>
          </section>

          <section>
            <h2>What is saved when you create a handoff</h2>
            <ul>
              <li>
                Only the items you reviewed and confirmed: visit details, medication changes, next steps and who is responsible, things to
                watch for, questions, and any notes you kept. Each item may include the sentence from the summary it came from.
              </li>
              <li>
                For each person you share with: their name and role, which parts they can see, when they opened their link, when they tapped
                &ldquo;I&apos;ve read this,&rdquo; and any updates they made to their next steps (including notes). Your first name is saved too.
              </li>
              <li>The full text of the summary is not saved.</li>
              <li>
                The original document is saved only if you turn on <strong>Attach the original summary</strong>. It is kept in private
                storage, opens only through a link that checks the handoff still exists, and is deleted with the handoff.
              </li>
              <li>When someone taps &ldquo;I&apos;ve read this,&rdquo; the name they typed and the time are saved.</li>
              <li>PINs, personal links and your private manage key are stored only as one-way hashes.</li>
              <li>If you send feedback, it is stored without any link to a handoff, your IP address or your name.</li>
            </ul>
          </section>

          <section>
            <h2>Who can open a handoff</h2>
            <ul>
              <li>
                Each person you share with gets their own link and sees only the parts you chose for them. You can remove one person&apos;s
                access, or send them a new link, at any time without affecting anyone else.
              </li>
              <li>
                <strong>Anyone who has a person&apos;s link can open it if the handoff has no PIN.</strong> Links are long random codes that are
                hard to guess, but a link can be forwarded.
              </li>
              <li>
                New handoffs are protected with a 4-digit PIN by default. A PIN adds a second step; it does not confirm who someone is. Three
                wrong tries lock the handoff for 10 minutes.
              </li>
              <li>
                &ldquo;I&apos;ve read this&rdquo; and updates to next steps are recorded against the personal link they came from. That shows which
                link was used, not who was holding the phone: AfterVisit does not verify identity, so these are self-reported.
              </li>
              <li>Handoff pages ask search engines not to index them and send no referrer to other sites.</li>
            </ul>
          </section>

          <section>
            <h2>How long it lasts, and deleting it</h2>
            <ul>
              <li>
                Every handoff expires {TTL_DAYS} days after it is created. Expired handoffs stop opening right away and are deleted, along with
                any attached original, by a daily cleanup.
              </li>
              <li>You can delete a handoff at any time from your private manage link. Deletion is immediate.</li>
            </ul>
          </section>

          <section>
            <h2>Accounts, cookies and services we use</h2>
            <ul>
              <li>There are no accounts and no tracking cookies.</li>
              <li>The site is hosted on Vercel. Handoffs and attached originals are stored with Supabase in the United States.</li>
              <li>Page visits are counted with Vercel Web Analytics, which does not use cookies.</li>
              <li>To prevent abuse, a salted one-way hash of your IP address is kept for one day to count requests per hour.</li>
            </ul>
          </section>

          <section>
            <h2>Sharing someone&apos;s health information</h2>
            <p>
              Only share information you are allowed to share. Before creating a handoff you confirm that you are the patient, or that you have
              the patient&apos;s permission or legal authority to share it with the people you choose.
            </p>
          </section>

          <section>
            <h2>Where AfterVisit stands</h2>
            <p>
              AfterVisit is a prototype. It has not completed a formal privacy, security or HIPAA compliance review, and it does not give
              medical advice: it organizes what the clinician wrote.
            </p>
          </section>

          <section>
            <h2>Open source</h2>
            <p>
              The source code is public under the AGPL-3.0 license, so you can read exactly how the site works.{" "}
              <a className="text-primary-700 underline" href={SOURCE_URL} target="_blank" rel="noreferrer">
                Read the source code
              </a>
              . Being open source makes the code inspectable; it does not by itself make a service secure.
            </p>
          </section>
        </div>
      </main>
    </PageShell>
  );
}
