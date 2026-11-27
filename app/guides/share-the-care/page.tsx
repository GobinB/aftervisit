import type { Metadata } from "next";
import Link from "next/link";
import { HowACircleWorks } from "@/components/home/HowACircleWorks";
import { InfoPage, LINK } from "@/components/InfoPage";
import { JsonLd } from "@/components/JsonLd";
import { COPY } from "@/lib/copy";
import { howTo, pageSeo } from "@/lib/seo";

const TITLE = "Sharing the care: keeping family and aides on the same page";
const DESCRIPTION =
  "Seven plain habits for families who share the care of an older parent with siblings, a home aide or a day program: one place for the plan, a name on every task, and a dated medicine list.";

export const metadata: Metadata = pageSeo("/guides/share-the-care", { title: TITLE, description: DESCRIPTION });

const HABITS = [
  {
    title: "Keep one place for the plan",
    body: "When the plan lives in five text threads, someone always has the old version. Pick one place everyone can open: a shared page, a notebook on the kitchen counter, or a printed sheet on the fridge that one person keeps current.",
  },
  {
    title: "Put a name on every task",
    body: "“Someone should call the pharmacy” means nobody will. Write each task with a person and a day: “Ana calls the pharmacy on Tuesday.” When it is done, cross it off where everyone can see.",
  },
  {
    title: "After each visit, update the plan once",
    body: "Bring the visit summary home and check it against what the doctor said. Then change the plan in one place, instead of retelling it to each person. If something on the paper is unclear, call the clinic and ask.",
  },
  {
    title: "Keep the medicine list current, with dates",
    body: "Write down each medicine, its strength and when it is taken. When something changes, note the date. Take the list to every appointment and to the pharmacy, so the people who prescribe can check it.",
  },
  {
    title: "Give each helper what they need, not everything",
    body: "A home aide needs today's tasks and what to watch for. A brother two states away may want the whole picture. Deciding who sees what protects your parent's privacy and keeps each person's view simple.",
  },
  {
    title: "Keep emergency information where anyone can find it",
    body: "Phone numbers for the family, the doctors and the pharmacy, plus allergies, on one page. In a hurry, nobody should have to search through messages.",
  },
  {
    title: "Check in once a week",
    body: "Five minutes on a call or in a group message: what is coming up, who is taking it, and what changed. Short and regular beats long and rare.",
  },
];

export default function ShareTheCareGuide() {
  return (
    <InfoPage
      label="Guide"
      title={TITLE}
      lead="When a parent is looked after by siblings, a home aide or a day program, most mix-ups come from one person knowing something the others don't. These seven habits help, whatever tool you use."
    >
      <JsonLd data={howTo("/guides/share-the-care", TITLE, DESCRIPTION, HABITS)} />
      <ol className="!list-none !pl-0">
        {HABITS.map(({ title, body }, index) => (
          <li key={title} className="!mt-8 flex gap-4">
            <span className="font-display w-8 shrink-0 text-[2rem] leading-none text-[#E5644E]" aria-hidden="true">
              {index + 1}
            </span>
            <div className="min-w-0">
              <h2 className="!mt-0 !text-[1.3rem]">{title}</h2>
              <p className="!mt-2">{body}</p>
            </div>
          </li>
        ))}
      </ol>

      <h2>Where All Hands Care fits</h2>
      <p>
        All Hands Care was built around these habits: one page for the calendar, reminders and medicines, a name on every reminder,
        every medicine change dated, and a private link for each helper that shows only what you choose. No account needed; a helper who
        is in more than one circle can sign in to keep them all in one place. It is free.{" "}
        <Link className={LINK} href="/">
          See how it works
        </Link>
        .
      </p>
      <div className="mt-6">
        <HowACircleWorks />
      </div>
      <p className="!mt-8 border-t border-border-200 pt-5 text-[14px] text-ink-500">{COPY.notMedicalAdvice}</p>
    </InfoPage>
  );
}
