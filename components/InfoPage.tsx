import { PageShell } from "./PageShell";

/** Body styles for plain reading pages (About, Contact, For care teams, guides), matching the terms page. */
export const PROSE =
  "[&_h2]:font-display [&_h2]:mt-10 [&_h2]:text-[1.5rem] [&_h2]:leading-tight [&_h2]:text-primary-900 [&_h3]:mt-6 [&_h3]:text-[1.05rem] [&_h3]:font-semibold [&_h3]:text-ink-900 [&_li]:mt-1.5 [&_p]:mt-3 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:mt-3 [&_ol]:list-decimal [&_ol]:pl-5";

export const LINK = "text-primary-700 underline underline-offset-2 hover:text-primary-900";

/** A reading page: small label, serif title, a short lead, then the content. */
export function InfoPage({ label, title, lead, children }: { label: string; title: string; lead: React.ReactNode; children: React.ReactNode }) {
  return (
    <PageShell>
      <main id="main" className="flex-1 overflow-x-clip bg-white">
        <div className={`mx-auto max-w-[760px] px-4 py-12 sm:px-6 sm:py-16 ${PROSE}`}>
          <p className="text-[12px] font-semibold tracking-[0.14em] text-attn-ink uppercase">{label}</p>
          <h1 className="font-display mt-2 text-[2.2rem] leading-tight text-primary-900 sm:text-[2.6rem]">{title}</h1>
          <p className="!mt-4 text-[1.1rem] leading-relaxed text-ink-500">{lead}</p>
          {children}
        </div>
      </main>
    </PageShell>
  );
}
