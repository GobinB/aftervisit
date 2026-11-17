import type { Metadata } from "next";
import { Bug, Lock, Mail, MessageCircleHeart, Users } from "lucide-react";
import Link from "next/link";
import { InfoPage, LINK } from "@/components/InfoPage";
import { CONTACT_EMAIL, PRIVACY_EMAIL, mailto } from "@/lib/contact";

export const metadata: Metadata = {
  title: "Contact",
  description: "Questions, feedback, or want to try All Hands Care with your family? Write to us.",
};

const WAYS = [
  {
    icon: Users,
    title: "Try it with your family",
    body: "We are looking for families who share the care of a parent or other relative, with or without a paid aide or day program. We will set it up with you in about 15 minutes and check in after a few days. Tell us your first name, your city, and who helps today.",
    address: CONTACT_EMAIL,
    subject: "I'd like to try All Hands Care",
  },
  {
    icon: MessageCircleHeart,
    title: "Tell us what you think",
    body: "Something confusing, something broken, something missing. Please don't smooth it over: that is the most useful thing you can tell us.",
    address: CONTACT_EMAIL,
    subject: "Feedback on All Hands Care",
  },
  {
    icon: Mail,
    title: "Questions",
    body: "How it works, using it with your agency or day program, or anything else.",
    address: CONTACT_EMAIL,
    subject: "A question about All Hands Care",
  },
  {
    icon: Lock,
    title: "Privacy",
    body: "Questions about your information, or a request to see, copy, correct or delete it.",
    address: PRIVACY_EMAIL,
    subject: "Privacy request",
  },
  {
    icon: Bug,
    title: "Security",
    body: "Found a security problem? Please tell us and do not use it.",
    address: CONTACT_EMAIL,
    subject: "Security report",
  },
];

export default function ContactPage() {
  return (
    <InfoPage label="Contact" title="Write to us" lead="A real person reads every message. Please don't include health details or anyone's medicines.">
      <ul className="!mt-8 !list-none space-y-3 !pl-0">
        {WAYS.map(({ icon: Icon, title, body, address, subject }) => (
          <li key={title} className="!mt-0 flex gap-4 rounded-xl border border-border-200 bg-surface-50 p-5">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-sky-100 text-primary-700">
              <Icon className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2 className="!mt-0 !font-sans !text-[1.1rem] font-semibold !text-ink-900">{title}</h2>
              <p className="!mt-1 text-ink-500">{body}</p>
              <a className={`${LINK} mt-2 inline-block font-semibold break-all`} href={mailto(address, subject)}>
                {address}
              </a>
            </div>
          </li>
        ))}
      </ul>
      <p className="text-ink-500">
        Run a home care agency, a day program, or work as a care manager?{" "}
        <Link className={LINK} href="/care-teams">
          See how All Hands Care works for care teams
        </Link>
        .
      </p>
    </InfoPage>
  );
}
