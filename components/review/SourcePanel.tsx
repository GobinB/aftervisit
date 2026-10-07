"use client";
import { FileText, X } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";

/** Finds the active item's text in the source by simple string search. */
function findRange(source: string, query: string): [number, number] | null {
  const q = query.trim();
  if (q.length < 3) return null;
  const lower = source.toLowerCase();
  const tries = [q, q.split(/\s+/).slice(0, 5).join(" "), q.split(/\s+/).slice(0, 3).join(" "), q.split(/\s+/)[0]];
  for (const t of tries) {
    if (t.length < 3) continue;
    const i = lower.indexOf(t.toLowerCase());
    if (i >= 0) return [i, i + t.length];
  }
  return null;
}

export function SourceText({ source, query }: { source: string; query: string }) {
  const range = useMemo(() => findRange(source, query), [source, query]);
  const markRef = useRef<HTMLElement>(null);
  useEffect(() => {
    markRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [range]);
  if (!source) return <p className="text-ink-500">No source text for this visit.</p>;
  return (
    <div className="text-[0.95rem] leading-relaxed whitespace-pre-wrap text-ink-900/90">
      {range ? (
        <>
          {source.slice(0, range[0])}
          <mark ref={markRef} className="rounded bg-med-bg px-0.5 text-ink-900">
            {source.slice(range[0], range[1])}
          </mark>
          {source.slice(range[1])}
        </>
      ) : (
        source
      )}
    </div>
  );
}

/** Desktop right rail (320 px) with the original summary. */
export function SourceRail({ source, query }: { source: string; query: string }) {
  return (
    <aside aria-labelledby="source-title" className="sticky top-20 hidden max-h-[calc(100dvh-7rem)] w-[320px] shrink-0 flex-col rounded-2xl border border-border-200 bg-white lg:flex">
      <h2 id="source-title" className="flex items-center gap-2 border-b border-border-200 px-4 py-3 font-semibold text-primary-700">
        <FileText size={20} aria-hidden="true" /> Original summary
      </h2>
      <div className="overflow-y-auto px-4 py-3" tabIndex={0} role="region" aria-label="Original summary text">
        <SourceText source={source} query={query} />
      </div>
    </aside>
  );
}

/** Mobile bottom sheet with the original summary. */
export function SourceSheet({ open, onClose, source, query }: { open: boolean; onClose: () => void; source: string; query: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      aria-labelledby="sheet-title"
      className="m-0 mt-auto max-h-[80dvh] w-full max-w-none rounded-t-2xl bg-white p-0 backdrop:bg-ink-900/40 lg:hidden"
    >
      <div className="flex items-center justify-between border-b border-border-200 px-4 py-3">
        <h2 id="sheet-title" className="flex items-center gap-2 font-semibold text-primary-700">
          <FileText size={20} aria-hidden="true" /> Original summary
        </h2>
        <button type="button" onClick={onClose} className="rounded-lg p-2 text-ink-500 hover:bg-surface-50" aria-label="Close original summary">
          <X size={20} aria-hidden="true" />
        </button>
      </div>
      <div className="max-h-[calc(80dvh-3.5rem)] overflow-y-auto px-4 py-3" tabIndex={0} role="region" aria-label="Original summary text">
        <SourceText source={source} query={query} />
      </div>
    </dialog>
  );
}
