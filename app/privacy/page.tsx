import { Eye, HeartHandshake, ShieldCheck, Trash2, type LucideIcon } from "lucide-react";
import type { Metadata } from "next";
import { SOURCE_URL } from "@/components/AppBar";
import { DemoNotice } from "@/components/DemoNotice";
import { PageShell } from "@/components/PageShell";
import { providerDisclosure } from "@/lib/extract/provider";
import { MEMBER_TTL_DAYS } from "@/lib/schema/circles";

export const metadata: Metadata = { title: "Privacy" };
export const dynamic = "force-dynamic";

const TTL_DAYS = Number(process.env.HANDOFF_TTL_DAYS || 30);
const EFFECTIVE = "November 5, 2026";

const PROMISES: { icon: LucideIcon; title: string; body: string }[] = [
  { icon: Eye, title: "You decide who sees what", body: "Each person gets their own link to only the parts you choose. Turn off any link at any time." },
  { icon: HeartHandshake, title: "Never sold, no ads", body: "We don't sell information, show ads, or use tracking cookies." },
  { icon: ShieldCheck, title: "Only what's needed", body: "We keep what you enter. The full text of a visit summary is not saved." },
  { icon: Trash2, title: "Delete it any time", body: "Deleting a circle closes it for everyone at once, and erases it for good after 30 days." },
];

const SECTIONS = [
  { id: "collect", title: "Information we collect" },
  { id: "use", title: "How we use it" },
  { id: "see", title: "Who can see it" },
  { id: "services", title: "Services we use" },
  { id: "keep", title: "How long we keep it" },
  { id: "choices", title: "Your choices" },
  { id: "security", title: "Security" },
  { id: "children", title: "Children" },
  { id: "changes", title: "Changes and questions" },
];

export default function PrivacyPage() {
  const provider = providerDisclosure();
  return (
    <PageShell>
      <main id="main" className="flex-1 overflow-x-clip">
        <section className="bg-primary-900 text-white">
          <div className="mx-auto max-w-[1000px] px-4 py-12 sm:px-6 sm:py-16">
            <p className="text-[12px] font-semibold tracking-[0.14em] text-[#F6B7AA] uppercase">Privacy</p>
            <h1 className="font-display mt-3 text-[2.2rem] leading-tight sm:text-[2.8rem]">You control the information. We protect it.</h1>
            <p className="mt-3 max-w-2xl text-white/80">How All Hands Care handles what families share, in plain language.</p>
          </div>
        </section>

        <section aria-label="Our promises" className="bg-paper-100">
          <div className="mx-auto max-w-[1000px] px-4 py-10 sm:px-6">
            <ul className="grid gap-4 sm:grid-cols-2">
              {PROMISES.map(({ icon: Icon, title, body }) => (
                <li key={title} className="rounded-xl bg-white p-5">
                  <Icon className="size-6 text-primary-700" aria-hidden="true" />
                  <h2 className="mt-3 font-semibold text-ink-900">{title}</h2>
                  <p className="mt-1 text-ink-500">{body}</p>
                </li>
              ))}
            </ul>
            <div className="mt-4 rounded-xl border border-[#F6CFC6] bg-[#FCEDEA] p-5">
              <h2 className="font-semibold text-ink-900">About HIPAA</h2>
              <p className="mt-1 text-ink-900">
                HIPAA covers doctors, hospitals, health plans and the companies that work for them. All Hands Care is a free tool that families
                use on their own, so HIPAA generally does not apply to what you keep here. We still treat it as sensitive health information:
                it is encrypted on its way to and from the site, every circle is walled off from every other in the database, and files are
                kept in private storage. All Hands Care has not yet completed a formal privacy and security review.
              </p>
            </div>
            <DemoNotice className="mt-4" />
          </div>
        </section>

        <section aria-labelledby="policy-title" className="bg-white">
          <div className="mx-auto grid max-w-[1000px] gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[200px_minmax(0,1fr)]">
            <nav aria-label="On this page" className="hidden lg:block">
              <p className="text-[12px] font-semibold tracking-[0.12em] text-ink-500 uppercase">On this page</p>
              <ul className="sticky top-24 mt-3 space-y-2 text-[14px]">
                {SECTIONS.map((section) => (
                  <li key={section.id}>
                    <a href={`#${section.id}`} className="text-ink-500 hover:text-primary-900">
                      {section.title}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
            <div className="min-w-0 [&_h3]:font-display [&_h3]:text-[1.4rem] [&_h3]:text-primary-900 [&_li]:mt-1.5 [&_p]:mt-2 [&_section]:scroll-mt-24 [&_ul]:mt-2 [&_ul]:list-disc [&_ul]:pl-5">
              <h2 id="policy-title" className="font-display text-[1.9rem] leading-tight text-primary-900">
                Privacy policy
              </h2>
              <p className="text-[14px] text-ink-500">Effective {EFFECTIVE}</p>

              <div className="mt-8 space-y-9">
                <section id="collect">
                  <h3>Information we collect</h3>
                  <ul>
                    <li>
                      <strong>Your account.</strong> Caregivers sign in with Google. Google shares your name, email address and profile photo
                      with our sign-in service. We never see your Google password.
                    </li>
                    <li>
                      <strong>What you enter for the person you look after:</strong> the care summary (allergies, doctors, pharmacy, emergency
                      contacts), the calendar, to-dos and medication list, with each medication change and when it was made.
                    </li>
                    <li>
                      <strong>The people you add:</strong> their name, role, which parts they can see, an optional email for your own mail app,
                      and when they last opened their link. Links and PINs are stored only as one-way hashes.
                    </li>
                    <li>
                      <strong>What people do on their link:</strong> who took or finished a to-do and who said they would go to an event.
                    </li>
                    <li>
                      <strong>Visit summaries.</strong> Pasted text and PDFs are read on our server to build a draft and are not saved. Photos
                      are read in your browser; only the text is sent. We keep only the items you confirm. The original document is kept only
                      if you choose to attach it.
                    </li>
                    <li>
                      <strong>Feedback</strong> you send, stored without your name, IP address or any link to your circle.
                    </li>
                    <li>
                      <strong>Technical data.</strong> Page visits are counted without cookies. To prevent abuse, a salted one-way hash of
                      your IP address is kept for one day.
                    </li>
                  </ul>
                </section>

                <section id="use">
                  <h3>How we use it</h3>
                  <p>Only to run All Hands Care for you and the people you choose. We do not sell it, rent it, or use it for advertising.</p>
                </section>

                <section id="see">
                  <h3>Who can see it</h3>
                  <ul>
                    <li>You, the caregiver who signed in.</li>
                    <li>
                      The people you add, through their own link, and only the parts their role and your choices allow. Home aides and day
                      programs see only the to-dos given to them.
                    </li>
                    <li>
                      Anyone who has a person&apos;s link can open it, because a link can be forwarded. Add a PIN for a second step, and turn
                      off a link if it is shared by mistake.
                    </li>
                    <li>Pages opened from a link ask search engines not to index them.</li>
                  </ul>
                </section>

                <section id="services">
                  <h3>Services we use</h3>
                  <ul>
                    <li>Vercel hosts the site. Supabase stores the information, in the United States.</li>
                    <li>Google provides sign-in for caregivers.</li>
                    <li>
                      Visit summary drafts are built by <strong>{provider.label}</strong>.
                      {provider.thirdParty ? (
                        <>
                          {" "}
                          The text of your summary is sent to that service; see its{" "}
                          <a className="text-primary-700 underline" href={provider.termsUrl} target="_blank" rel="noreferrer">
                            terms
                          </a>
                          .
                        </>
                      ) : null}
                    </li>
                    <li>
                      Medication name suggestions come from the U.S. National Library of Medicine&apos;s public list. Our server downloads the
                      whole list and searches it itself, so what you type is not sent to the Library.
                    </li>
                    <li>Vercel Web Analytics counts page visits without cookies.</li>
                  </ul>
                </section>

                <section id="keep">
                  <h3>How long we keep it</h3>
                  <ul>
                    <li>A care circle is kept until you delete it. Nobody can open it after that, and 30 days later it is erased for good, with everything in it.</li>
                    <li>A shared visit summary (handoff) is deleted {TTL_DAYS} days after it is made, with any attached original.</li>
                    <li>A helper&apos;s browser stays signed in to a circle for up to {MEMBER_TTL_DAYS} days after they last open it.</li>
                    <li>Cookies are used only to keep you signed in.</li>
                  </ul>
                </section>

                <section id="choices">
                  <h3>Your choices</h3>
                  <ul>
                    <li>Change what each person sees, or turn off their link, from People.</li>
                    <li>Delete a circle from its Settings. Nobody can open it again, every link stops working, and it is erased after 30 days.</li>
                    <li>Only share information you are allowed to share: you confirm this when you start a circle.</li>
                  </ul>
                </section>

                <section id="security">
                  <h3>Security</h3>
                  <p>
                    Information is encrypted between your device and the site. In the database, each circle is walled off from every other,
                    and only the people you add can reach it. No system is perfectly secure, and All Hands Care has not yet completed a formal
                    review. The code is open source, so anyone can{" "}
                    <a className="text-primary-700 underline" href={SOURCE_URL} target="_blank" rel="noreferrer">
                      read how it works
                    </a>
                    .
                  </p>
                </section>

                <section id="children">
                  <h3>Children</h3>
                  <p>All Hands Care is for adults caring for someone. It is not meant for children under 13 to use on their own.</p>
                </section>

                <section id="changes">
                  <h3>Changes and questions</h3>
                  <p>
                    If this policy changes, we will update the date above and say what changed. All Hands Care organizes what you and the
                    clinician wrote; it does not give medical advice.
                  </p>
                </section>
              </div>
            </div>
          </div>
        </section>
      </main>
    </PageShell>
  );
}
