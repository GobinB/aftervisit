import { ClipboardCheck, Clock, Code2, Lock, Share2, Upload } from "lucide-react";
import { AppBar } from "@/components/AppBar";
import { ButtonLink } from "@/components/Button";
import { Footer } from "@/components/Footer";
import { StartSample } from "@/components/StartSample";

const STEPS = [
  { icon: Upload, title: "Upload", body: "Add the after-visit summary as a PDF, a photo, or pasted text." },
  { icon: ClipboardCheck, title: "Review and confirm", body: "Check each change and task. Nothing is shared until you confirm it." },
  { icon: Share2, title: "Share a link", body: "Send one clear page to family, a home aide or the day program." },
];

const TRUST = [
  { icon: Lock, text: "Nothing is saved until you share." },
  { icon: Clock, text: "Links expire in 30 days." },
  { icon: Code2, text: "Open source under AGPL." },
];

export default function Home() {
  return (
    <>
      <AppBar />
      <main id="main" className="mx-auto max-w-[720px] px-4">
        <section className="pt-12 pb-10 sm:pt-20">
          <p className="text-sm font-semibold uppercase tracking-wider text-primary-700">For family caregivers</p>
          <h1 className="mt-3 text-[2rem] leading-tight font-semibold tracking-tight text-primary-900 sm:text-[2.6rem]">
            Turn an after-visit summary into a care handoff everyone understands.
          </h1>
          <p className="mt-4 max-w-xl text-lg text-ink-500">
            AfterVisit pulls out what changed and what needs to happen next. You confirm every item, then share one
            read-only page with the people who help.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="/new" className="sm:min-w-56">
              <Upload size={20} aria-hidden="true" /> Upload my summary
            </ButtonLink>
            <StartSample className="sm:min-w-56" />
          </div>
        </section>

        <section aria-labelledby="how" className="pb-10">
          <h2 id="how" className="sr-only">
            How it works
          </h2>
          <ol className="grid gap-3 sm:grid-cols-3">
            {STEPS.map(({ icon: Icon, title, body }, i) => (
              <li key={title} className="rounded-2xl bg-sky-100 p-5">
                <div className="flex items-center gap-2 text-primary-700">
                  <Icon size={22} aria-hidden="true" />
                  <span className="text-sm font-semibold">Step {i + 1}</span>
                </div>
                <h3 className="mt-2 text-lg font-semibold text-primary-900">{title}</h3>
                <p className="mt-1 text-ink-900/80">{body}</p>
              </li>
            ))}
          </ol>
        </section>

        <ul className="flex flex-col gap-2 border-t border-border-200 py-6 text-sm text-ink-500 sm:flex-row sm:gap-6">
          {TRUST.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-2">
              <Icon size={16} aria-hidden="true" />
              {text}
            </li>
          ))}
        </ul>
      </main>
      <Footer />
    </>
  );
}
