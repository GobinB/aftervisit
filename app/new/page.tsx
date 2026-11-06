"use client";
import { ArrowLeft, ArrowRight, Camera, CheckCircle2, FileText, ImageIcon, Loader2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { visitContextAction } from "@/app/actions/visits";
import { Button } from "@/components/Button";
import { BackLink } from "@/components/circles/PageHead";
import { StepHeader } from "@/components/StepHeader";
import { COPY } from "@/lib/copy";
import type { HandoffDraft } from "@/lib/schema";
import { setOriginalFile, setOriginalPages, useFlow } from "@/lib/store";

const MAX_MB = Number(process.env.NEXT_PUBLIC_MAX_UPLOAD_MB || 10);
const MIN_TEXT = 50;
const MAX_PAGES = 15;

type Kind = "pdf" | "image";
function kindOf(f: File): Kind | null {
  if (f.type === "application/pdf" || /\.pdf$/i.test(f.name)) return "pdf";
  if (/^image\/(jpeg|png|heic|heif|webp)$/i.test(f.type) || /\.(jpe?g|png|heic|heif|webp)$/i.test(f.name)) return "image";
  return null;
}

const STEP_LABELS = ["Reading the summary", "Finding what changed", "Finding what happens next"];

interface ExtractResponse {
  draft?: HandoffDraft;
  unsorted?: boolean;
  error?: string;
  message?: string;
}

export default function IntakePage() {
  const router = useRouter();
  const startDraft = useFlow((s) => s.startDraft);
  const setOriginalName = useFlow((s) => s.setOriginalName);
  const savedCaregiver = useFlow((s) => s.caregiverFirstName);

  const [files, setFiles] = useState<File[]>([]);
  const [pasteMode, setPasteMode] = useState(false);
  const [text, setText] = useState("");
  const [patient, setPatient] = useState("");
  const [caregiver, setCaregiver] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [stepsDone, setStepsDone] = useState(0);
  const [ocr, setOcr] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const pdfRef = useRef<HTMLInputElement>(null);
  const [ocrPage, setOcrPage] = useState<{ page: number; of: number } | null>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const ids = { file: useId(), patient: useId(), caregiver: useId(), text: useId() };
  // Started from a care circle (/new?circle=<id>): confirming updates that circle's medications and to-dos.
  const [circle, setCircle] = useState<{ id: string; personName: string } | null>(null);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("circle");
    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return;
    visitContextAction(id)
      .then((context) => {
        if (!context.ok) return;
        setCircle({ id, personName: context.personName });
        setPatient((current) => current || context.personName.split(/\s+/)[0].slice(0, 60));
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (savedCaregiver && !caregiver) setCaregiver(savedCaregiver);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  const kind = files[0] ? kindOf(files[0]) : null;
  const ready = pasteMode ? text.trim().length >= MIN_TEXT : files.length > 0;

  function addFiles(list: FileList | File[]) {
    setError(null);
    const arr = Array.from(list);
    if (!arr.length) return;
    for (const f of arr) {
      if (!kindOf(f)) return setError(COPY.uploadType);
      if (f.size > MAX_MB * 1024 * 1024) return setError(COPY.uploadSize(MAX_MB));
    }
    const pdfs = arr.filter((f) => kindOf(f) === "pdf");
    if (pdfs.length) {
      // One PDF at a time.
      setFiles([pdfs[0]]);
      return;
    }
    // Photos: several pages are fine.
    setFiles((cur) => (cur.length && kindOf(cur[0]) === "image" ? [...cur, ...arr].slice(0, MAX_PAGES) : arr.slice(0, MAX_PAGES)));
  }

  async function build() {
    if (!ready || processing) return;
    setError(null);
    setProcessing(true);
    setStepsDone(0);
    setOcr(null);
    const started = Date.now();
    const t1 = setTimeout(() => setStepsDone((n) => Math.max(n, 1)), 1000);
    const t2 = setTimeout(() => setStepsDone((n) => Math.max(n, 2)), 4000);

    try {
      let res: Response;
      if (pasteMode) {
        res = await fetch("/api/extract", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, patientFirstName: patient || undefined }),
        });
      } else if (kind === "pdf") {
        const fd = new FormData();
        fd.append("file", files[0]);
        if (patient) fd.append("patientFirstName", patient);
        res = await fetch("/api/extract", { method: "POST", body: fd });
      } else {
        // Photos are read here in the browser; only the text is sent.
        const { ocrImages } = await import("@/lib/ocr");
        setOcr(0);
        const ocrText = await ocrImages(files, (p) => {
          setOcr(p.progress);
          setOcrPage({ page: p.page, of: files.length });
        });
        if (ocrText.replace(/\s+/g, "").length < 20) throw new UserError(COPY.nothingParsed);
        res = await fetch("/api/extract", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: ocrText, patientFirstName: patient || undefined }),
        });
      }

      const data = (await res.json().catch(() => ({}))) as ExtractResponse;
      if (!res.ok || !data.draft) throw new UserError(data.message || COPY.genericError);

      setStepsDone(3);
      const wait = Math.max(0, 1500 - (Date.now() - started));
      await new Promise((r) => setTimeout(r, wait + 350));

      setOriginalFile(files.length === 1 ? files[0] : null);
      setOriginalPages(pasteMode ? [] : files);
      setOriginalName(files.length === 1 ? files[0].name : null);
      startDraft(data.draft, { isSample: false, unsorted: !!data.unsorted, caregiverFirstName: caregiver.trim(), circleId: circle?.id ?? null });
      router.push("/new/review");
    } catch (e) {
      setProcessing(false);
      setError(e instanceof UserError ? e.message : navigator.onLine ? COPY.genericError : COPY.offline);
    } finally {
      clearTimeout(t1);
      clearTimeout(t2);
    }
  }

  if (processing) {
    return (
      <div className="mx-auto flex min-h-[60dvh] max-w-[720px] items-center justify-center">
        <div className="w-full max-w-md animate-fade-in rounded-2xl border border-border-200 bg-white p-8 text-center">
          {ocr === null ? (
            <div className="mx-auto mb-6 flex h-16 w-16 animate-pulse-ring items-center justify-center rounded-full bg-sky-100">
              <Loader2 className="animate-spin text-action-500" size={28} aria-hidden="true" />
            </div>
          ) : (
            <div className="mb-6">
              <p className="mb-2 text-[15px] text-ink-500">
                {ocrPage && ocrPage.of > 1 ? `Reading page ${ocrPage.page} of ${ocrPage.of}` : "Reading the photo"} on this device… {Math.round(ocr * 100)}%
              </p>
              <div
                className="h-2.5 overflow-hidden rounded-full bg-sky-100"
                role="progressbar"
                aria-label="Reading the photo"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(ocr * 100)}
              >
                <div className="h-full rounded-full bg-action-500 transition-[width] duration-300" style={{ width: `${Math.round(ocr * 100)}%` }} />
              </div>
            </div>
          )}
          <h1 className="font-display text-xl font-medium text-primary-900">Building the draft</h1>
          <ol className="mt-5 space-y-3 text-left" aria-live="polite">
            {STEP_LABELS.map((label, i) => {
              const done = stepsDone > i;
              return (
                <li key={label} className="flex items-center gap-3">
                  {done ? (
                    <CheckCircle2 className="animate-pop text-ok" size={22} aria-hidden="true" />
                  ) : (
                    <span className="h-[22px] w-[22px] rounded-full border-2 border-border-200" aria-hidden="true" />
                  )}
                  <span className={done ? "text-ink-900" : "text-ink-500"}>
                    {label}
                    {done ? <span className="sr-only"> (done)</span> : null}
                  </span>
                </li>
              );
            })}
          </ol>
          <p className="mt-6 text-sm text-ink-500">
            This usually takes a few seconds. Photos take longer while your phone reads the text.
          </p>
        </div>
      </div>
    );
  }

  const pageCount = kind === "image" ? files.length : 0;
  const move = (from: number, to: number) =>
    setFiles((cur) => {
      if (to < 0 || to >= cur.length) return cur;
      const next = [...cur];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  const takePhoto = () => cameraRef.current?.click();
  const choosePhotos = () => inputRef.current?.click();

  return (
    <div className="mx-auto max-w-[720px]">
      <BackLink href={circle ? `/circles/${circle.id}` : "/"} label={circle ? "Today" : "Home"} />
      <StepHeader current="Upload" circle={Boolean(circle)} />
      <h1 className="font-display text-[2rem] leading-tight font-medium text-primary-900">Scan after-visit summary</h1>
      <p className="mt-2 text-[16px] text-ink-500">
        {pasteMode ? "Paste the text from the patient portal." : "Take a photo of each page. Add as many pages as there are, then tap Done."}
      </p>
      {circle ? (
        <p className="mt-4 rounded-lg border border-sky-100 bg-sky-100/60 px-4 py-3 text-[14px] text-primary-900">
          For <span className="font-semibold">{circle.personName}</span>. You check everything before it goes into their circle: medicines,
          reminders and appointments.
        </p>
      ) : null}

      {/* Camera: one page per tap. Library: several at once. Both add to the same pages. */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          if (e.target.files) addFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <input
        ref={inputRef}
        id={ids.file}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/heic,image/heif,.heic,.heif,image/webp"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          if (e.target.files) addFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <input
        ref={pdfRef}
        type="file"
        accept="application/pdf,.pdf"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          if (e.target.files) addFiles(e.target.files);
          e.target.value = "";
        }}
      />

      <div
        className="mt-6"
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          addFiles(e.dataTransfer.files);
        }}
      >
        {pasteMode ? (
          <>
            <label htmlFor={ids.text} className="font-medium">
              Paste the summary text
            </label>
            <textarea
              id={ids.text}
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={10}
              autoFocus
              placeholder="Copy everything from the after-visit summary in the patient portal and paste it here."
              className="mt-2 w-full rounded-xl border border-border-200 bg-white p-3 text-base outline-none focus:border-action-500 focus:ring-2 focus:ring-action-500/30"
            />
            <p className="mt-1 text-sm text-ink-500">
              {text.trim().length < MIN_TEXT ? `At least ${MIN_TEXT} characters.` : `${text.trim().length.toLocaleString()} characters.`}
            </p>
            <button
              type="button"
              className="mt-2 min-h-11 rounded-md text-[15px] font-semibold text-primary-700 underline underline-offset-4"
              onClick={() => {
                setPasteMode(false);
                setError(null);
              }}
            >
              Take photos instead
            </button>
          </>
        ) : kind === "pdf" ? (
          <div className="flex items-center gap-3 rounded-xl border border-border-200 bg-white px-4 py-3">
            <FileText size={24} className="shrink-0 text-primary-700" aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate font-medium">{files[0].name}</span>
            <button
              type="button"
              className="inline-flex size-11 items-center justify-center rounded-lg text-ink-500 hover:bg-attn-bg hover:text-attn-ink"
              aria-label={`Remove ${files[0].name}`}
              onClick={() => setFiles([])}
            >
              <X size={20} aria-hidden="true" />
            </button>
          </div>
        ) : pageCount ? (
          <>
            <ol className="grid grid-cols-2 gap-3 sm:grid-cols-3" aria-label="Pages">
              {files.map((file, index) => (
                <li key={`${file.name}-${file.lastModified}-${index}`} className="overflow-hidden rounded-xl border border-border-200 bg-white">
                  <div className="relative aspect-[3/4] bg-paper-100">
                    <Thumb file={file} />
                    <span className="absolute top-2 left-2 rounded-full bg-sidebar px-2.5 py-1 text-[13px] font-bold text-white">Page {index + 1}</span>
                    <button
                      type="button"
                      className="absolute top-1.5 right-1.5 inline-flex size-10 items-center justify-center rounded-full bg-white/95 text-attn-ink shadow"
                      aria-label={`Remove page ${index + 1}`}
                      onClick={() => setFiles((cur) => cur.filter((_, j) => j !== index))}
                    >
                      <X size={20} aria-hidden="true" />
                    </button>
                  </div>
                  <div className="flex border-t border-border-200">
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() => move(index, index - 1)}
                      aria-label={`Move page ${index + 1} earlier`}
                      className="inline-flex min-h-11 flex-1 items-center justify-center text-primary-700 hover:bg-sky-100 disabled:text-border-200"
                    >
                      <ArrowLeft size={20} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      disabled={index === files.length - 1}
                      onClick={() => move(index, index + 1)}
                      aria-label={`Move page ${index + 1} later`}
                      className="inline-flex min-h-11 flex-1 items-center justify-center border-l border-border-200 text-primary-700 hover:bg-sky-100 disabled:text-border-200"
                    >
                      <ArrowRight size={20} aria-hidden="true" />
                    </button>
                  </div>
                </li>
              ))}
              {files.length < MAX_PAGES ? (
                <li>
                  <button
                    type="button"
                    onClick={takePhoto}
                    className="flex aspect-[3/4] h-full w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary-700/40 bg-white text-[15px] font-bold text-primary-700 hover:bg-sky-100/60"
                  >
                    <Camera size={30} aria-hidden="true" />
                    Add a page
                  </button>
                </li>
              ) : null}
            </ol>
            <button type="button" onClick={choosePhotos} className="mt-3 min-h-11 text-[15px] font-semibold text-primary-700 underline underline-offset-4">
              Add pages from my photos
            </button>
          </>
        ) : (
          <div className={`rounded-2xl border-2 border-dashed p-4 transition-colors sm:p-6 ${dragging ? "border-action-500 bg-sky-100" : "border-border-200 bg-white"}`}>
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={takePhoto}
                className="flex min-h-20 items-center justify-center gap-3 rounded-xl bg-primary-700 px-4 text-[18px] font-bold text-white hover:bg-primary-900"
              >
                <Camera size={28} aria-hidden="true" /> Take a photo
              </button>
              <button
                type="button"
                onClick={choosePhotos}
                className="flex min-h-20 items-center justify-center gap-3 rounded-xl border-2 border-primary-700 bg-white px-4 text-[18px] font-bold text-primary-700 hover:bg-sky-100"
              >
                <ImageIcon size={28} aria-hidden="true" /> Choose photos
              </button>
            </div>
            <p className="mt-3 text-center text-[13px] text-ink-500">One photo per page. Lay the page flat, in good light. You can also drop files here.</p>
          </div>
        )}
        {!pasteMode && !pageCount && kind !== "pdf" ? (
          <p className="mt-3 flex flex-wrap gap-x-5 gap-y-1">
            <button type="button" onClick={() => pdfRef.current?.click()} className="min-h-11 text-[15px] font-semibold text-primary-700 underline underline-offset-4">
              Use a PDF instead
            </button>
            <button
              type="button"
              className="min-h-11 text-[15px] font-semibold text-primary-700 underline underline-offset-4"
              onClick={() => {
                setPasteMode(true);
                setError(null);
              }}
            >
              Paste the text instead
            </button>
          </p>
        ) : null}
      </div>

      {/* A circle already knows who the visit was for, and nothing is shared from this flow, so the names are not asked. */}
      <div className={circle ? "hidden" : "mt-6 grid gap-4 sm:grid-cols-2"}>
        <div>
          <label htmlFor={ids.patient} className="font-medium">
            Who was the visit for? <span className="font-normal text-ink-500">(first name)</span>
          </label>
          <input
            id={ids.patient}
            value={patient}
            onChange={(e) => setPatient(e.target.value)}
            autoComplete="off"
            maxLength={60}
            className="mt-1.5 h-12 w-full rounded-xl border border-border-200 bg-white px-3 text-[16px] outline-none focus:border-action-500 focus:ring-2 focus:ring-action-500/30"
          />
        </div>
        <div>
          <label htmlFor={ids.caregiver} className="font-medium">
            Your first name
          </label>
          <input
            id={ids.caregiver}
            value={caregiver}
            onChange={(e) => setCaregiver(e.target.value)}
            autoComplete="given-name"
            maxLength={60}
            aria-describedby={`${ids.caregiver}-help`}
            className="mt-1.5 h-12 w-full rounded-xl border border-border-200 bg-white px-3 text-[16px] outline-none focus:border-action-500 focus:ring-2 focus:ring-action-500/30"
          />
          <p id={`${ids.caregiver}-help`} className="mt-1 text-sm text-ink-500">
            Shown on the handoff so people know who prepared it.
          </p>
        </div>
      </div>

      {error ? (
        <p ref={errorRef} tabIndex={-1} role="alert" className="mt-6 rounded-xl bg-attn-bg px-4 py-3 text-attn-ink">
          {error}
        </p>
      ) : null}

      {ready ? (
        <div className="sticky bottom-0 z-10 -mx-4 mt-6 border-t border-border-200 bg-surface-50/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0">
          <Button className="w-full sm:w-auto sm:min-w-64" onClick={build}>
            {pageCount ? `Done: read ${pageCount} page${pageCount === 1 ? "" : "s"}` : circle ? "Done: read the summary" : "Build the handoff"}
          </Button>
        </div>
      ) : null}
      <p className="mt-3 text-sm text-ink-500">
        {kind === "image" || !files.length
          ? "Photos are read on this device. Only the text is sent to All Hands Care's server to build the draft, and it is not saved."
          : "Your file is sent to All Hands Care's server to build the draft and is not saved."}
      </p>
    </div>
  );
}

/** A small preview of one page. HEIC photos some browsers cannot show get a plain icon instead. */
function Thumb({ file }: { file: File }) {
  // Drawn onto a canvas from the file's pixels, so no URL made from the file is ever put into the page.
  const canvas = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    createImageBitmap(file)
      .then((bitmap) => {
        const el = canvas.current;
        const ctx = el?.getContext("2d");
        if (cancelled || !el || !ctx) return bitmap.close();
        const width = 300;
        const height = 400;
        el.width = width;
        el.height = height;
        // Cover the box like object-fit: cover.
        const scale = Math.max(width / bitmap.width, height / bitmap.height);
        const w = bitmap.width * scale;
        const h = bitmap.height * scale;
        ctx.drawImage(bitmap, (width - w) / 2, (height - h) / 2, w, h);
        bitmap.close();
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [file]);
  if (failed) {
    return (
      <span className="flex h-full w-full items-center justify-center text-primary-700">
        <ImageIcon size={36} aria-hidden="true" />
      </span>
    );
  }
  return <canvas ref={canvas} aria-hidden="true" className="h-full w-full" />;
}

class UserError extends Error {}
