import type { Metadata } from "next";
import { SOURCE_URL } from "@/components/AppBar";
import { PageShell } from "@/components/PageShell";
import { activeProviderName } from "@/lib/extract/provider";

export const metadata: Metadata = { title: "Privacy" };
export const dynamic = "force-dynamic";

export default function PrivacyPage() {
  const ai = activeProviderName();
  return (
    <PageShell>
      <main id="main" className="mx-auto w-full max-w-[720px] flex-1 px-4 pt-10 pb-16">
        <h1 className="text-[2rem] font-semibold text-primary-900">Privacy</h1>
        <p className="mt-3 text-lg text-ink-500">Plain language, no fine print.</p>

        <div className="mt-8 space-y-8 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-primary-700 [&_li]:mt-2 [&_p]:mt-2 [&_ul]:list-disc [&_ul]:pl-6">
          <section>
            <h2>What we store, and when</h2>
            <ul>
              <li>Nothing is stored while you upload, read or edit the draft. The draft lives in this browser tab.</li>
              <li>
                A handoff is stored only when you press <strong>Create handoff</strong>, and only the content you confirmed, the names and roles
                of the people you added, and a copy of the extracted text with obvious identifiers removed (date of birth, record numbers,
                addresses, phone numbers, insurance IDs and the patient name line).
              </li>
              <li>
                Your original document is stored only if you turn on <strong>Attach the original summary</strong>. It goes into a private
                storage bucket tied to that one handoff and is deleted with it.
              </li>
              <li>When someone taps “I&apos;ve read this”, we store the name they typed and the time.</li>
            </ul>
          </section>
          <section>
            <h2>How your document is read</h2>
            <ul>
              <li>PDFs are read in memory on AfterVisit&apos;s own server and discarded. They are never written to disk or logged.</li>
              <li>Photos are read entirely in your browser. The photo never leaves your phone; only the recognized text is sent.</li>
              {ai === "heuristic" ? (
                <li>No third-party AI service sees your document. AfterVisit uses a built-in parser that runs on its own server.</li>
              ) : (
                <li>
                  This deployment uses Anthropic&apos;s Claude API to draft the handoff, so the extracted text is sent to Anthropic. See{" "}
                  <a className="text-primary-700 underline" href="https://www.anthropic.com/legal/commercial-terms" target="_blank" rel="noreferrer">
                    Anthropic&apos;s commercial terms
                  </a>
                  .
                </li>
              )}
            </ul>
          </section>
          <section>
            <h2>How long it lasts, and how to delete it</h2>
            <ul>
              <li>Every handoff expires 30 days after it is created and is deleted automatically, including any attached original.</li>
              <li>You can delete a handoff at any time from your private manage link. Deletion is immediate.</li>
            </ul>
          </section>
          <section>
            <h2>Who can see a handoff</h2>
            <ul>
              <li>Only people with the link. Links are long and unguessable, and you can add a 4-digit PIN.</li>
              <li>Handoff pages tell search engines not to index them and send no referrer to other sites.</li>
            </ul>
          </section>
          <section>
            <h2>Accounts, cookies and analytics</h2>
            <ul>
              <li>There are no accounts and no tracking cookies.</li>
              <li>We count page visits with Vercel Web Analytics, which uses no cookies and collects no personal information.</li>
              <li>To prevent abuse we keep a salted, one-way hash of your IP address for one day to count requests per hour.</li>
            </ul>
          </section>
          <section>
            <h2>Not a medical service</h2>
            <p>
              AfterVisit organizes what the clinician wrote. It does not interpret it, give advice, or check for drug interactions. AfterVisit
              is not a HIPAA covered entity; it is a tool caregivers use on their own information.
            </p>
          </section>
          <section>
            <h2>Open source</h2>
            <p>
              The full source code is public under the AGPL-3.0 license, so anyone can check these claims.{" "}
              <a className="text-primary-700 underline" href={SOURCE_URL} target="_blank" rel="noreferrer">
                Read the source code
              </a>
              .
            </p>
          </section>
        </div>
      </main>
    </PageShell>
  );
}
