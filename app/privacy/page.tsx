import { Eye, HeartHandshake, ShieldCheck, Trash2, type LucideIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { SOURCE_URL } from "@/components/AppBar";
import { PageShell } from "@/components/PageShell";
import { PRIVACY_EMAIL } from "@/lib/contact";
import { providerDisclosure } from "@/lib/extract/provider";
import { MEMBER_TTL_DAYS } from "@/lib/schema/circles";

export const metadata: Metadata = { title: "Privacy" };
export const dynamic = "force-dynamic";

const TTL_DAYS = Number(process.env.HANDOFF_TTL_DAYS || 30);
const EFFECTIVE = "November 13, 2026";

const PROMISES: { icon: LucideIcon; title: string; body: string }[] = [
  { icon: Eye, title: "You decide who sees what", body: "Each person gets their own link to only the parts you choose. Turn off any link at any time." },
  { icon: HeartHandshake, title: "Never sold, no ads", body: "We don't sell information, show ads, or use tracking cookies." },
  { icon: ShieldCheck, title: "Only what's needed", body: "We keep what you enter. A visit summary's photos are kept only if you choose, and they are encrypted on your device before they are sent." },
  { icon: Trash2, title: "Delete it any time", body: "Deleting a circle closes it for everyone at once, and erases it for good after 30 days." },
];

const SECTIONS = [
  { id: "who", title: "Who we are" },
  { id: "collect", title: "Information we collect" },
  { id: "read", title: "What we can read" },
  { id: "use", title: "How we use it" },
  { id: "see", title: "Who can see it" },
  { id: "share", title: "When we share information" },
  { id: "services", title: "Services we use" },
  { id: "where", title: "Where information is kept" },
  { id: "keep", title: "How long we keep it" },
  { id: "cookies", title: "Cookies" },
  { id: "choices", title: "Your choices" },
  { id: "rights", title: "Your rights" },
  { id: "others", title: "Information about other people" },
  { id: "security", title: "Security" },
  { id: "breach", title: "If something goes wrong" },
  { id: "children", title: "Children" },
  { id: "changes", title: "Changes" },
  { id: "contact", title: "Contact us" },
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
                it is encrypted on its way to and from the site, every circle is walled off from every other, and saved photos are encrypted on
                your device before they are stored. Some states have their own health-data laws; see our{" "}
                <Link className="underline" href="/privacy/health-data">
                  health data notice
                </Link>
                . All Hands Care has not yet completed a formal privacy and security review.
              </p>
            </div>
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
                <section id="who">
                  <h3>Who we are</h3>
                  <p>
                    All Hands Care is a free, nonprofit, open-source care page for families. &ldquo;We&rdquo; means the people who run it. Write
                    to us any time at{" "}
                    <a className="text-primary-700 underline" href={`mailto:${PRIVACY_EMAIL}`}>
                      {PRIVACY_EMAIL}
                    </a>
                    .
                  </p>
                </section>

                <section id="collect">
                  <h3>Information we collect</h3>
                  <ul>
                    <li>
                      <strong>Your account.</strong> Caregivers sign in with Google. Google shares your name, email address and profile photo
                      with our sign-in service. We never see your Google password.
                    </li>
                    <li>
                      <strong>What you enter for the person you look after:</strong> the care summary (allergies, doctors, pharmacy, emergency
                      contacts), the calendar, reminders and medication list, with each medication change and when it was made.
                    </li>
                    <li>
                      <strong>The people you add:</strong> their name, role, which parts they can see, an optional email for your own mail app,
                      and when they last opened their link. On our server, links and PINs are stored only as one-way hashes. Your own browser
                      remembers each person&apos;s link (never the PIN) so you can share it again; signing out removes them.
                    </li>
                    <li>
                      <strong>What people do on their link:</strong> who took or finished a reminder and who said they would go to an event.
                    </li>
                    <li>
                      <strong>Visit summaries.</strong> Photos are read in your browser; only the text is sent to our server. Pasted text and
                      PDFs are read on our server. Either way the text is used to build a draft and is not saved: we keep only the items you
                      confirm. The photos (or PDF) are kept only if you leave &ldquo;Keep the photos&rdquo; on. They are encrypted on your device before they
                      are sent, and we keep the key so you can open them on any device after you sign in.
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

                <section id="read">
                  <h3>What we can read</h3>
                  <ul>
                    <li>
                      <strong>Saved photos and PDFs of visit summaries</strong> are encrypted on your device before they are sent, so our
                      file storage and our database hold only scrambled files and locked keys. All Hands Care keeps the key to each
                      circle&apos;s files, protected by a secret that is held apart from the database, and hands it to you after you sign in.
                      That is why they open on any phone or computer with nothing to remember. It also means we are technically able to open
                      these files. In the app they are shown only to you, the caregiver; no feature shows them to anyone else, and the
                      people you add cannot open them.
                    </li>
                    <li>
                      <strong>We can read</strong> the rest of a circle: the care summary, medications, reminders, calendar, and the names and
                      roles of the people you add. Our server has to read these to show each person their part. They are protected by the
                      access rules described under Security.
                    </li>
                    <li>
                      <strong>Passing through.</strong> The text of a visit summary reaches our server while the draft is built. It is not
                      saved.
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
                    <li>
                      You, the caregiver who signed in. Saved photos of visit summaries are shown only to you, after you sign in. The people
                      you add cannot see them from their links.
                    </li>
                    <li>
                      The people you add, through their own link, and only the parts their role and your choices allow. Home aides and day
                      programs see only the reminders given to them.
                    </li>
                    <li>
                      Anyone who has a person&apos;s link can open it, because a link can be forwarded. Add a PIN for a second step. If a link
                      is shared by mistake, make a new link or remove the person: every phone that opened the old link is signed out.
                    </li>
                    <li>The people you add see your name as it appears on your Google account.</li>
                    <li>
                      If you turn on the calendar link, anyone who has that link can see the circle&apos;s appointments and reminders (not
                      medicines). Make a new link or turn it off any time from Calendar, Add to my calendar.
                    </li>
                    <li>Pages opened from a link ask search engines not to index them.</li>
                  </ul>
                </section>

                <section id="share">
                  <h3>When we share information</h3>
                  <p>We share information outside All Hands Care only in these cases:</p>
                  <ul>
                    <li>
                      <strong>With the services listed below,</strong> so they can host the site, store the information and sign you in.
                    </li>
                    <li>
                      <strong>When the law requires it,</strong> such as a court order or another valid legal demand. We give only what the
                      demand covers and, where the law allows, we tell the caregiver first. Because we keep the key to saved photos and PDFs, a valid
                      demand could cover those too.
                    </li>
                    <li>
                      <strong>To protect someone&apos;s safety,</strong> if we believe in good faith that it is needed to prevent serious
                      harm.
                    </li>
                    <li>
                      <strong>If someone else takes over running All Hands Care.</strong> This policy would still apply to your information,
                      and we would tell caregivers before that happens.
                    </li>
                  </ul>
                </section>

                <section id="services">
                  <h3>Services we use</h3>
                  <ul>
                    <li>
                      <strong>Vercel</strong> hosts the site (
                      <a className="text-primary-700 underline" href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noreferrer">
                        privacy policy
                      </a>
                      ).
                    </li>
                    <li>
                      <strong>Supabase</strong> stores the information and saved photos, encrypted at rest, and runs sign-in (
                      <a className="text-primary-700 underline" href="https://supabase.com/privacy" target="_blank" rel="noreferrer">
                        privacy policy
                      </a>
                      ).
                    </li>
                    <li>
                      <strong>Google</strong> provides sign-in for caregivers (
                      <a className="text-primary-700 underline" href="https://policies.google.com/privacy" target="_blank" rel="noreferrer">
                        privacy policy
                      </a>
                      ).
                    </li>
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
                    <li>
                      To read photos in your browser, it downloads the reading engine from jsDelivr and Project Naptha. They see that a browser
                      asked for the engine (its IP address), never your photos or their text.
                    </li>
                    <li>
                      If you add the calendar link to Google Calendar, Apple Calendar or Outlook, that company receives the appointments and
                      reminders (titles, times, places and notes) and keeps its own copy under its own privacy terms.
                    </li>
                    <li>Vercel Web Analytics counts page visits without cookies.</li>
                    <li>These companies handle information only to provide their service to us. We do not sell or share it with anyone else.</li>
                    <li>All Hands Care links to a few other sites. What happens there follows their privacy terms, not this policy.</li>
                  </ul>
                </section>

                <section id="where">
                  <h3>Where information is kept</h3>
                  <p>
                    All Hands Care is run from the United States, and the information is stored there. If you use it from another country,
                    your information is sent to and kept in the United States, where privacy laws may differ from those where you live.
                  </p>
                </section>

                <section id="keep">
                  <h3>How long we keep it</h3>
                  <ul>
                    <li>
                      A care circle is kept until you delete it. Nobody can open it after that, and 30 days later it is erased for good, with
                      everything in it, saved photos included.
                    </li>
                    <li>Saved photos of a visit summary are kept until you delete them, or the circle.</li>
                    <li>Our database provider keeps backup copies for up to 7 days, so erased information leaves the backups within a week.</li>
                    <li>A shared visit summary (handoff) is deleted {TTL_DAYS} days after it is made, with any attached original.</li>
                    <li>A helper&apos;s browser stays signed in to a circle for up to {MEMBER_TTL_DAYS} days after they last open it.</li>
                  </ul>
                </section>

                <section id="cookies">
                  <h3>Cookies</h3>
                  <p>
                    Cookies are used only to run the site: to keep you signed in, to keep a helper&apos;s link open on their phone, to remember
                    which circle you opened last, and for a few minutes while Google sign-in finishes. None are used for ads or tracking,
                    and page visits are counted without cookies.
                  </p>
                </section>

                <section id="choices">
                  <h3>Your choices</h3>
                  <ul>
                    <li>Change what each person sees, or turn off their link, from People.</li>
                    <li>Delete a circle from its Settings. Nobody can open it again, every link stops working, and it is erased after 30 days.</li>
                    <li>Delete saved photos of a visit summary from Care summary, Saved visit summaries.</li>
                    <li>Turn the calendar link on or off, or replace it, from Calendar, Add to my calendar.</li>
                    <li>Only share information you are allowed to share: you confirm this when you start a circle.</li>
                  </ul>
                </section>

                <section id="rights">
                  <h3>Your rights</h3>
                  <p>Wherever you live, you can ask us to:</p>
                  <ul>
                    <li>show you the information we hold about you, or the person you care for, and who it has been shared with;</li>
                    <li>give you a copy of it;</li>
                    <li>correct it;</li>
                    <li>delete it.</li>
                  </ul>
                  <p>
                    Most of this you can do yourself in the app. For anything else, email{" "}
                    <a className="text-primary-700 underline" href={`mailto:${PRIVACY_EMAIL}`}>
                      {PRIVACY_EMAIL}
                    </a>
                    . We will check that the request comes from you, and answer within 45 days. If we say no, you can ask us to look again by
                    replying to that email; we answer that within 45 days too. If you live in Washington and we still say no, you can
                    complain to the Washington State Attorney General. More for Washington, Nevada and Connecticut is in our{" "}
                    <Link className="text-primary-700 underline" href="/privacy/health-data">
                      health data notice
                    </Link>
                    .
                  </p>
                </section>

                <section id="others">
                  <h3>Information about other people</h3>
                  <p>
                    A circle holds information about the person you care for and the people you add. Only enter it if you are allowed to:
                    you are that person, or they (or their legal representative) agreed. Someone you added who wants to be removed can ask
                    you, or email us and we will help.
                  </p>
                </section>

                <section id="security">
                  <h3>Security</h3>
                  <p>
                    Information is encrypted between your device and the site, and stored encrypted by our database provider. For
                    caregivers, the database itself walls each circle off from every other. People with a link reach a circle only through our
                    server, which checks on every request what their role and your choices let them see. Saved photos and PDFs of visit
                    summaries are also encrypted on your device before they are stored, and we keep the key, as described under{" "}
                    <a className="text-primary-700 underline" href="#read">
                      What we can read
                    </a>
                    ; the rest of a circle is not encrypted that way. No system is perfectly secure, and All Hands Care has not yet completed a
                    formal review. The code is open source, so anyone can{" "}
                    <a className="text-primary-700 underline" href={SOURCE_URL} target="_blank" rel="noreferrer">
                      read how it works
                    </a>
                    .
                  </p>
                </section>

                <section id="breach">
                  <h3>If something goes wrong</h3>
                  <p>
                    If we learn that someone who should not have seen information in All Hands Care did see it, we will tell the caregivers
                    affected, by email to their Google address, as soon as we can: what happened, what information, and what we are doing
                    about it. We will also tell anyone the law requires us to.
                  </p>
                </section>

                <section id="children">
                  <h3>Children</h3>
                  <p>
                    Caregivers and the people they add must be 18 or older. A circle can be about a child in your care, entered by an adult
                    who is allowed to.
                  </p>
                </section>

                <section id="changes">
                  <h3>Changes</h3>
                  <p>
                    If this policy changes, we will update the date above and say what changed. Before a big change, we will show a notice in
                    the app. All Hands Care organizes what you and the clinician wrote; it does not give medical advice.
                  </p>
                  <p>
                    <strong>Latest change, {EFFECTIVE}:</strong> saved photos and PDFs of visit summaries no longer use 12 recovery words.
                    All Hands Care now keeps the key to them, so they open on any device after you sign in. Before this change we could not
                    open those files; now we are technically able to, as described under{" "}
                    <a className="text-primary-700 underline" href="#read">
                      What we can read
                    </a>
                    . Photos saved before the change come under it once a device that still has their key, or the 12 words, hands the key
                    over.
                  </p>
                </section>

                <section id="contact">
                  <h3>Contact us</h3>
                  <p>
                    Questions, requests or worries about privacy:{" "}
                    <a className="text-primary-700 underline" href={`mailto:${PRIVACY_EMAIL}`}>
                      {PRIVACY_EMAIL}
                    </a>
                    .
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
