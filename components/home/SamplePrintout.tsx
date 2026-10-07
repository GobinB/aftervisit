import { SAMPLE_QUOTES, SAMPLE_SOURCE_TEXT } from "@/lib/sample";

const MARKED = Object.values(SAMPLE_QUOTES);

/** The fictional after-visit summary, rendered from the same text the sample uses, with each instruction highlighted. */
export function SamplePrintout({ className = "", fade = false }: { className?: string; fade?: boolean }) {
  const lines = SAMPLE_SOURCE_TEXT.split("\n");
  return (
    <div
      className={`relative overflow-hidden rounded-[3px] bg-white px-5 pt-5 pb-6 font-mono text-[10px] leading-[1.6] text-ink-900/75 shadow-[0_22px_48px_-20px_rgb(28_36_51/0.5)] ring-1 ring-black/10 sm:text-[11px] ${className}`}
    >
      <span className="absolute top-3 right-3 rotate-[6deg] rounded border-2 border-attn/70 px-1.5 py-0.5 font-sans text-[10px] font-bold tracking-[0.18em] text-attn-ink/90 uppercase">
        Fictional
      </span>
      {lines.map((line, i) => {
        if (!line.trim()) return <div key={i} className="h-2" />;
        const body = line.replace(/^- /, "");
        const bullet = line.startsWith("- ") ? "- " : "";
        const hit = MARKED.find((q) => body === q || body.startsWith(q));
        return (
          <p key={i} className={i === 0 ? "pr-16 font-semibold text-ink-900/90" : ""}>
            {bullet}
            {hit ? (
              <>
                <span className="marker">{hit}</span>
                {body.slice(hit.length)}
              </>
            ) : (
              body
            )}
          </p>
        );
      })}
      {fade ? <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-white to-transparent" /> : null}
    </div>
  );
}
