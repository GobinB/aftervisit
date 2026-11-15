"use client";
import { FileText, Images, Loader2, X, ZoomIn, ZoomOut } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { findLine, type LineBox } from "@/lib/find-line";
import { readPageLines, stopPageLineReader, toImageBlob } from "@/lib/ocr";

/** The line an item came from: its sentence, and the page it is on when the reader said. */
export type SourceTarget = { quote: string; page?: number };

/** Finds the active item's text in the source by simple string search. */
export function findRange(source: string, query: string): [number, number] | null {
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

/** The text of the summary, large, with the matching line marked and scrolled into view. */
export function SourceText({ source, query }: { source: string; query: string }) {
  const range = useMemo(() => findRange(source, query), [source, query]);
  const markRef = useRef<HTMLElement>(null);
  useEffect(() => {
    markRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [range]);
  if (!source) return <p className="text-ink-500">No source text for this visit.</p>;
  return (
    <div className="text-[17px] leading-relaxed whitespace-pre-wrap text-ink-900">
      {range ? (
        <>
          {source.slice(0, range[0])}
          <mark ref={markRef} className="rounded bg-med-bg px-0.5 text-ink-900 ring-2 ring-med/60">
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

/**
 * One photographed page, drawn large from the phone's own copy (it was never uploaded to be shown
 * here). `box` marks the line an item came from; `wide` makes the page twice as wide to read small print.
 */
function PagePhoto({ file, n, of, box, wide, active }: { file: File; n: number; of: number; box: LineBox | null; wide: boolean; active: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const figure = useRef<HTMLElement>(null);
  const mark = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    toImageBlob(file)
      .then((blob) => createImageBitmap(blob))
      .then((bitmap) => {
        const el = canvas.current;
        const ctx = el?.getContext("2d");
        if (cancelled || !el || !ctx) return bitmap.close();
        const scale = Math.min(1, 2000 / bitmap.width);
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
  // Bring the page, and then the marked line, into view when an item points here.
  useEffect(() => {
    if (!active) return;
    (box ? mark.current : figure.current)?.scrollIntoView({ block: box ? "center" : "start", behavior: "smooth" });
  }, [active, box]);
  return (
    <figure ref={figure} className={`scroll-mt-40 overflow-hidden rounded-lg border bg-white ${active ? "border-med ring-2 ring-med/40" : "border-border-200"}`}>
      <figcaption className="border-b border-border-200 bg-paper-100 px-3 py-1.5 text-[13px] font-semibold text-ink-500">
        Page {n} of {of}
      </figcaption>
      {failed ? (
        <p className="px-3 py-6 text-center text-[14px] text-ink-500">This photo cannot be shown in this browser.</p>
      ) : (
        <div className="overflow-x-auto">
          <div className="relative" style={{ width: wide ? "200%" : "100%" }}>
            <canvas ref={canvas} role="img" aria-label={`Page ${n} of the summary`} className="block h-auto w-full" />
            {box ? (
              <div
                ref={mark}
                data-testid="line-mark"
                aria-hidden="true"
                className="pointer-events-none absolute rounded-sm bg-[#fde68a]/45 ring-2 ring-med"
                style={{ left: `${box.x * 100}%`, top: `${box.y * 100}%`, width: `${box.w * 100}%`, height: `${box.h * 100}%` }}
              />
            ) : null}
          </div>
        </div>
      )}
    </figure>
  );
}

type Found = { quote: string; page: number; box: LineBox } | { quote: string; page: number | null; box: null };

/**
 * Looks for the sentence on the photos, on this device. With a page from the reader, only that page
 * is read; without one, the pages are read in order until the sentence turns up.
 */
function useLineOnPhoto(photos: File[], target: SourceTarget | null, enabled: boolean): { found: Found | null; looking: boolean } {
  const [found, setFound] = useState<Found | null>(null);
  const [looking, setLooking] = useState(false);
  useEffect(() => {
    if (!enabled || !target || !photos.length) {
      setFound(null);
      setLooking(false);
      return;
    }
    let cancelled = false;
    const known = target.page && target.page <= photos.length ? target.page : null;
    setFound(null);
    setLooking(true);
    (async () => {
      const order = known ? [known] : photos.map((_, i) => i + 1);
      for (const page of order) {
        const lines = await readPageLines(photos[page - 1]);
        if (cancelled) return;
        const box = findLine(lines, target.quote);
        if (box) {
          setFound({ quote: target.quote, page, box });
          setLooking(false);
          return;
        }
      }
      if (!cancelled) {
        setFound({ quote: target.quote, page: known, box: null });
        setLooking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [photos, target, enabled]);
  return { found: found && target && found.quote === target.quote ? found : null, looking };
}

/**
 * The summary as it was given, large: the photos, when it was photographed, and the text read from
 * it. When an item points here ("See it in the original"), its sentence is pinned at the top, the
 * right page comes into view, and the line is marked: in the text always, and on the photo when this
 * device can find it there.
 */
export function OriginalView({
  source,
  pages,
  target,
  onClear,
  visible = true,
  headingId,
  stickyClass = "top-0",
}: {
  source: string;
  pages: File[];
  target: SourceTarget | null;
  onClear: () => void;
  /** False while the original is not on screen (the draft is showing on a phone), so nothing is read for nothing. */
  visible?: boolean;
  headingId: string;
  /** Where the heading sticks: the top of its own scrolling box on a computer, under the app bar on a phone. */
  stickyClass?: string;
}) {
  const photos = useMemo(() => pages.filter((file) => !/pdf/i.test(file.type) && !/\.pdf$/i.test(file.name)), [pages]);
  const [tab, setTab] = useState<"photos" | "text">(photos.length ? "photos" : "text");
  const [wide, setWide] = useState(false);
  const onPhotos = tab === "photos" && photos.length > 0;
  const { found, looking } = useLineOnPhoto(photos, target, visible && onPhotos);
  useEffect(() => () => stopPageLineReader(), []);
  // A new item to look at shows the photos again, where the paper itself can be checked.
  useEffect(() => {
    if (target && photos.length) setTab("photos");
  }, [target, photos.length]);

  const page = found?.page ?? (target?.page && target.page <= photos.length ? target.page : null);
  const status = !target
    ? null
    : !onPhotos
      ? null
      : looking
        ? "Finding the line on the photo"
        : found?.box
          ? `Marked on page ${found.page}.`
          : page
            ? `We could not mark it on the photo. Look for it on page ${page}.`
            : "We could not mark it on the photo. Look for it on the pages below.";

  return (
    <div>
      <div className={`sticky z-10 border-b border-border-200 bg-white ${stickyClass}`}>
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
          <h2 id={headingId} className="flex items-center gap-2 font-semibold text-primary-700">
            <FileText size={20} aria-hidden="true" /> Original summary
          </h2>
          {photos.length ? (
            <div className="flex items-center gap-1.5">
              <div role="tablist" aria-label="How to show the original" className="flex gap-1.5">
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
              {onPhotos ? (
                <button
                  type="button"
                  onClick={() => setWide(!wide)}
                  aria-pressed={wide}
                  className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-border-200 bg-white px-3 text-[14px] font-semibold text-ink-900"
                >
                  {wide ? <ZoomOut className="size-4" aria-hidden="true" /> : <ZoomIn className="size-4" aria-hidden="true" />}
                  {wide ? "Smaller" : "Bigger"}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
        {target ? (
          <div className="flex items-start gap-2 border-t border-med/30 bg-med-bg px-4 py-2.5">
            <p className="min-w-0 flex-1 text-[15px] text-ink-900">
              <span className="block text-[12px] font-bold tracking-[0.06em] text-med-ink uppercase">Look for this line{page ? ` · page ${page}` : ""}</span>
              <span className="block font-medium break-words">{target.quote}</span>
              {status ? (
                <span role="status" className="mt-0.5 flex items-center gap-1.5 text-[13px] text-ink-500">
                  {looking ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : null}
                  {status}
                </span>
              ) : null}
            </p>
            <button type="button" onClick={onClear} className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg text-med-ink hover:bg-white/60" aria-label="Stop marking this line">
              <X size={20} aria-hidden="true" />
            </button>
          </div>
        ) : null}
      </div>
      <div className="px-4 py-3">
        {onPhotos ? (
          <div className="space-y-3">
            {photos.map((file, i) => (
              <PagePhoto
                key={`${file.name}-${i}`}
                file={file}
                n={i + 1}
                of={photos.length}
                wide={wide}
                active={!!target && page === i + 1}
                box={found?.box && found.page === i + 1 ? found.box : null}
              />
            ))}
          </div>
        ) : (
          <SourceText source={source} query={target?.quote ?? ""} />
        )}
      </div>
    </div>
  );
}
