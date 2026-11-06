"use client";
import { FileText, Images, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toImageBlob } from "@/lib/ocr";

/** Finds the active item's text in the source by simple string search. */
function findRange(source: string, query: string): [number, number] | null {
  const q = query.trim();
  if (q.length < 3) return null;
  // Exact sentence, ignoring line breaks and bullets the PDF or portal added.
  const words = q.split(/\s+/).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const exact = new RegExp(words.join("[\\s\\-•*]+"), "i").exec(source);
  if (exact) return [exact.index, exact.index + exact[0].length];
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

/** One photographed page, drawn from the phone's own copy (it was never uploaded to be shown here). */
function PagePhoto({ file, n, of }: { file: File; n: number; of: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    toImageBlob(file)
      .then((blob) => createImageBitmap(blob))
      .then((bitmap) => {
        const el = canvas.current;
        const ctx = el?.getContext("2d");
        if (cancelled || !el || !ctx) return bitmap.close();
        const scale = Math.min(1, 1400 / bitmap.width);
        el.width = Math.round(bitmap.width * scale);
        el.height = Math.round(bitmap.height * scale);
        ctx.drawImage(bitmap, 0, 0, el.width, el.height);
        bitmap.close();
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [file]);
  return (
    <figure className="overflow-hidden rounded-lg border border-border-200">
      <figcaption className="border-b border-border-200 bg-paper-100 px-3 py-1.5 text-[13px] font-semibold text-ink-500">
        Page {n} of {of}
      </figcaption>
      {failed ? (
        <p className="px-3 py-6 text-center text-[14px] text-ink-500">This photo cannot be shown in this browser.</p>
      ) : (
        <canvas ref={canvas} role="img" aria-label={`Page ${n} of the summary`} className="block h-auto w-full" />
      )}
    </figure>
  );
}

/**
 * The summary as it was given: the photos, when it was photographed, and the text that was read
 * from it. Tapping "View original instruction" on an item switches to the text with that line
 * highlighted; the photos are there to check that the reading was right.
 */
function SourceBody({ source, query, pages }: { source: string; query: string; pages: File[] }) {
  const photos = pages.filter((file) => !/pdf/i.test(file.type) && !/\.pdf$/i.test(file.name));
  const [tab, setTab] = useState<"photos" | "text">(photos.length ? "photos" : "text");
  useEffect(() => {
    if (query) setTab("text");
  }, [query]);
  return (
    <>
      {photos.length ? (
        <div role="tablist" aria-label="Original summary" className="sticky top-0 z-10 flex gap-1.5 border-b border-border-200 bg-white px-4 py-2">
          {(["photos", "text"] as const).map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className={`inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3.5 text-[14px] font-semibold ${
                tab === key ? "border-primary-700 bg-primary-700 text-white" : "border-border-200 bg-white text-ink-900"
              }`}
            >
              {key === "photos" ? <Images className="size-4" aria-hidden="true" /> : <FileText className="size-4" aria-hidden="true" />}
              {key === "photos" ? "Photos" : "What was read"}
            </button>
          ))}
        </div>
      ) : null}
      <div className="px-4 py-3">
        {tab === "photos" && photos.length ? (
          <div className="space-y-3">
            {photos.map((file, i) => (
              <PagePhoto key={`${file.name}-${i}`} file={file} n={i + 1} of={photos.length} />
            ))}
          </div>
        ) : (
          <SourceText source={source} query={query} />
        )}
      </div>
    </>
  );
}

/** Desktop right rail with the original summary: the photos and the text read from them. */
export function SourceRail({ source, query, pages = [] }: { source: string; query: string; pages?: File[] }) {
  return (
    <aside aria-labelledby="source-title" className="sticky top-20 hidden max-h-[calc(100dvh-7rem)] w-[380px] shrink-0 flex-col rounded-2xl border border-border-200 bg-white lg:flex">
      <h2 id="source-title" className="flex items-center gap-2 border-b border-border-200 px-4 py-3 font-semibold text-primary-700">
        <FileText size={20} aria-hidden="true" /> Original summary
      </h2>
      <div className="overflow-y-auto" tabIndex={0} role="region" aria-label="Original summary">
        <SourceBody source={source} query={query} pages={pages} />
      </div>
    </aside>
  );
}

/** Mobile bottom sheet with the original summary. */
export function SourceSheet({ open, onClose, source, query, pages = [] }: { open: boolean; onClose: () => void; source: string; query: string; pages?: File[] }) {
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
      className="m-0 mt-auto max-h-[88dvh] w-full max-w-none rounded-t-2xl bg-white p-0 backdrop:bg-ink-900/40 lg:hidden"
    >
      <div className="flex items-center justify-between border-b border-border-200 px-4 py-3">
        <h2 id="sheet-title" className="flex items-center gap-2 font-semibold text-primary-700">
          <FileText size={20} aria-hidden="true" /> Original summary
        </h2>
        <button type="button" onClick={onClose} className="inline-flex size-11 items-center justify-center rounded-lg text-ink-500 hover:bg-surface-50" aria-label="Close original summary">
          <X size={22} aria-hidden="true" />
        </button>
      </div>
      <div className="max-h-[calc(88dvh-3.5rem)] overflow-y-auto" tabIndex={0} role="region" aria-label="Original summary">
        {open ? <SourceBody source={source} query={query} pages={pages} /> : null}
      </div>
    </dialog>
  );
}
