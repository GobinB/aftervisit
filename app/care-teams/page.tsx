import type { Metadata } from "next";
import { Check } from "lucide-react";
import Link from "next/link";
import { InfoPage, LINK } from "@/components/InfoPage";
import { CONTACT_EMAIL, mailto } from "@/lib/contact";

export const metadata: Metadata = {
  title: "For care teams",
  description:
    "For home care agencies, day programs and care managers: the family keeps one shared care page, and your aides open their own link. No account, no app, free.",
};

const GETS = [
  "Each aide gets their own private link from the family. No account, no password, no app to install.",
  "Aides and day programs see only the reminders given to them and, from visit notes, what to watch for.",
  "They can tap “I’ll do it” and mark a reminder done, so the family knows it is handled.",
  "If the family caregiver adds their phone number, it is one tap away.",
];

const QUESTIONS = [
  {
    q: "Does it replace our scheduling or care records?",
    a: "No. Nothing changes in your own systems. All Hands Care is the family's page: it keeps everyone on the same page about appointments, reminders and medicines.",
  },
  {
    q: "What does it cost?",
    a: "Nothing, for you or for the family. There are no ads, and information is never sold.",
  },
  {
    q: "Do aides need training?",
    a: "No. They open a link on their phone and see the reminders given to them. Nothing to install or remember.",
  },
  {
    q: "Who controls the information?",
    a: "The family caregiver who started the circle. They choose what each person sees and can turn off any link at any time.",
  },
  {
    q: "Is it a medical tool?",
    a: "No. It organizes what the clinician wrote and what the family adds. It does not give medical advice, and it does not send alerts. In an emergency, call 911.",
  },
];

export default function CareTeamsPage() {
  return (
    <InfoPage
      label="For care teams"
      title="Your aides see what they need. The family sees it got done."
      lead="For home care agencies, adult day programs and care managers. The family keeps one shared care page for the person you serve, and each of your staff opens their own link."
    >
      <h2>What your team gets</h2>
      <ul className="!list-none !pl-0">
        {GETS.map((item) => (
          <li key={item} className="flex items-start gap-3">
            <Check className="mt-1 size-5 shrink-0 text-ok" strokeWidth={2.5} aria-hidden="true" />
            <span>{item}</span>
          </li>
        ))}
      </ul>

      <h2>Questions agencies ask</h2>
      {QUESTIONS.map(({ q, a }) => (
        <div key={q}>
          <h3>{q}</h3>
          <p className="!mt-1">{a}</p>
        </div>
      ))}

      <h2>Pass it on</h2>
      <p>
        If you think it would help a family you work with, tell them about it, or send them to{" "}
        <Link className={LINK} href="/">
          allhandscare.org
        </Link>
        . The family starts the circle and invites your staff. We never ask for client lists.
      </p>
      <p>
        Want a 20 minute look first? Write to{" "}
        <a className={LINK} href={mailto(CONTACT_EMAIL, "A look at All Hands Care for our team")}>
          {CONTACT_EMAIL}
        </a>
        , or try the sample visit on the{" "}
        <Link className={LINK} href="/">
          home page
        </Link>
        .
      </p>
    </InfoPage>
  );
}
