import type { Metadata } from "next";
import Link from "next/link";
import { InfoPage, LINK } from "@/components/InfoPage";
import { SOURCE_URL } from "@/components/AppBar";
import { CONTACT_EMAIL, mailto } from "@/lib/contact";
import { ASSEMBLY_CODE, CAREGIVING_FACTS, CAREGIVING_SOURCE, MAKER } from "@/lib/site";

export const metadata: Metadata = {
  title: "About",
  description: `Why All Hands Care exists and who makes it. Made by ${MAKER.name}. A project of Assembly Code, a nonprofit.`,
};

export default function AboutPage() {
  return (
    <InfoPage
      label="About"
      title="Why All Hands Care exists"
      lead="When an older parent is looked after by a few family members, a home aide and a day program, the plan lives in text threads, on paper and in one person's head. All Hands Care puts it on one page that everyone can open."
    >
      <h2>The problem</h2>
      <p>
        After a doctor&apos;s visit, someone has to tell everyone else what changed. Who is taking Mom to physical therapy on Thursday?
        Did the blood pressure pill change? Does the aide know? Usually one person ends up as the switchboard, passing the same news
        along by phone and text, over and over.
      </p>
      <ul className="!list-none !pl-0">
        {CAREGIVING_FACTS.map(({ figure, body }) => (
          <li key={figure} className="!mt-3 rounded-xl bg-paper-100 p-4">
            <span className="font-display text-[1.6rem] leading-none text-primary-900">{figure}</span>{" "}
            <span className="text-ink-900">{body}</span>
          </li>
        ))}
      </ul>
      <p className="text-[14px] text-ink-500">
        Source:{" "}
        <a className={LINK} href={CAREGIVING_SOURCE.url} target="_blank" rel="noreferrer">
          {CAREGIVING_SOURCE.title}
        </a>
        .
      </p>

      <h2>What we built</h2>
      <p>
        One shared page for the calendar, reminders, medicines and visit notes of the person you look after. One caregiver runs it. Everyone else, from a brother to a home
        aide, opens their own private link and sees only the parts the caregiver chooses. No account needed, though anyone can sign in
        to keep all their circles in one place. When a
        visit summary comes home, a photo of it becomes a draft of updates that the caregiver checks before anyone sees them.
      </p>

      <h2>Who makes it</h2>
      <p>
        All Hands Care is made by {MAKER.name} in {MAKER.place}. It is a project of{" "}
        <a className={LINK} href={ASSEMBLY_CODE.url} target="_blank" rel="noreferrer">
          {ASSEMBLY_CODE.name}
        </a>
        , a nonprofit incubator and studio for public interest software, which supports it through its incubator program.
      </p>

      <h2>What we promise</h2>
      <ul>
        <li>It is free. There are no ads, and information is never sold.</li>
        <li>
          The caregiver decides who sees what, and can turn off anyone&apos;s link at any time. Our{" "}
          <Link className={LINK} href="/privacy">
            privacy policy
          </Link>{" "}
          says exactly what we keep.
        </li>
        <li>
          The code is open source under the AGPL-3.0 license, so anyone can{" "}
          <a className={LINK} href={SOURCE_URL} target="_blank" rel="noreferrer">
            read how it works
          </a>
          .
        </li>
        <li>It organizes what the clinician wrote. It does not give medical advice.</li>
      </ul>

      <h2>It is new</h2>
      <p>
        We are trying All Hands Care with our first families now. If something is confusing or broken, that is the most useful thing
        you can tell us. Write to{" "}
        <a className={LINK} href={mailto(CONTACT_EMAIL, "Feedback on All Hands Care")}>
          {CONTACT_EMAIL}
        </a>{" "}
        or see{" "}
        <Link className={LINK} href="/contact">
          other ways to reach us
        </Link>
        .
      </p>
    </InfoPage>
  );
}
