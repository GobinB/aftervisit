import Link from "next/link";
import { COPY } from "@/lib/copy";
import { ASSEMBLY_CODE, MAKER } from "@/lib/site";
import { SOURCE_URL } from "./AppBar";
import { Logo } from "./Logo";

const LINK = "underline-offset-4 hover:text-primary-900 hover:underline";

const COLUMNS = [
  {
    title: "All Hands Care",
    links: [
      { href: "/#how", label: "How it works" },
      { href: "/#questions", label: "Questions" },
      { href: "/care-teams", label: "For care teams" },
      { href: "/guides/share-the-care", label: "Guide: sharing the care" },
    ],
  },
  {
    title: "About",
    links: [
      { href: "/about", label: "About us" },
      { href: "/contact", label: "Contact and feedback" },
      { href: SOURCE_URL, label: "Source code", external: true },
    ],
  },
  {
    title: "Your information",
    links: [
      { href: "/privacy", label: "Privacy" },
      { href: "/terms", label: "Terms" },
      { href: "/privacy/health-data", label: "Health data notice" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="no-print border-t border-border-200 bg-surface-50">
      <div className="mx-auto max-w-[1120px] px-4 py-10 sm:px-6">
        <div className="grid gap-8 md:grid-cols-[1.2fr_2fr]">
          <div>
            <Logo size={34} />
            <p className="mt-2 text-ink-500">A shared care page for the person you look after.</p>
          </div>
          <nav className="grid gap-6 sm:grid-cols-3" aria-label="Footer">
            {COLUMNS.map(({ title, links }) => (
              <div key={title}>
                <p className="text-[12px] font-semibold tracking-[0.12em] text-ink-500 uppercase">{title}</p>
                <ul className="mt-3 space-y-2 font-medium text-ink-900/80">
                  {links.map(({ href, label, external }) =>
                    external ? (
                      <li key={href}>
                        <a href={href} className={LINK} target="_blank" rel="noreferrer">
                          {label}
                        </a>
                      </li>
                    ) : (
                      <li key={href}>
                        <Link href={href} className={LINK}>
                          {label}
                        </Link>
                      </li>
                    ),
                  )}
                </ul>
              </div>
            ))}
          </nav>
        </div>
        <div className="mt-8 space-y-1 border-t border-border-200 pt-5 text-sm text-ink-500">
          <p>
            Made by {MAKER.name} in {MAKER.place}. A project of{" "}
            <a href={ASSEMBLY_CODE.url} className="font-semibold text-ink-900 underline underline-offset-2" target="_blank" rel="noreferrer">
              {ASSEMBLY_CODE.name}
            </a>
            , a nonprofit.
          </p>
          <p>{COPY.notMedicalAdvice} Free and open source (AGPL-3.0).</p>
        </div>
      </div>
    </footer>
  );
}
