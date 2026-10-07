"use client";
import { CheckCircle2, CloudUpload, FileText, ImageIcon, Loader2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/Button";
import { StepHeader } from "@/components/StepHeader";
import { COPY } from "@/lib/copy";
import type { HandoffDraft } from "@/lib/schema";
import { setOriginalFile, useFlow } from "@/lib/store";

const MAX_MB = Number(process.env.NEXT_PUBLIC_MAX_UPLOAD_MB || 10);
const MIN_TEXT = 50;

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
  const errorRef = useRef<HTMLParagraphElement>(null);
  const ids = { file: useId(), patient: useId(), caregiver: useId(), text: useId() };

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
    setFiles((cur) => (cur.length && kindOf(cur[0]) === "image" ? [...cur, ...arr].slice(0, 8) : arr.slice(0, 8)));
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
        const ocrText = await ocrImages(files, (p) => setOcr(p.progress));
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
      setOriginalName(files.length === 1 ? files[0].name : null);
      startDraft(data.draft, { isSample: false, unsorted: !!data.unsorted, caregiverFirstName: caregiver.trim() });
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
        <div className="w-full max-w-md animate-fade-in rounded-2xl border border-border-200 bg-white p-8 text-center shadow-sm">
          {ocr === null ? (
            <div className="mx-auto mb-6 flex h-16 w-16 animate-pulse-ring items-center justify-center rounded-full bg-sky-100">
              <Loader2 className="animate-spin text-action-500" size={28} aria-hidden="true" />
            </div>
          ) : (
            <div className="mb-6">
              <p className="mb-2 text-sm text-ink-500">Reading the photo on your phone… {Math.round(ocr * 100)}%</p>
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
          <h1 className="text-xl font-semibold text-primary-900">Building the draft</h1>
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

  return (
    <div className="mx-auto max-w-[720px]">
      <StepHeader current="Upload" />
      <h1 className="text-[1.75rem] leading-tight font-semibold text-primary-900">Add the after-visit summary</h1>
      <p className="mt-2 text-ink-500">A PDF from the patient portal, a photo of the printed pages, or the text pasted in.</p>

      <div className="mt-6">
        {!pasteMode ? (
          <>
            <label
              htmlFor={ids.file}
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
              className={`flex min-h-40 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 py-6 text-center transition-colors ${
                dragging ? "border-action-500 bg-sky-100" : "border-border-200 bg-white hover:bg-sky-100/50"
              }`}
            >
              <CloudUpload size={34} className="text-primary-700" aria-hidden="true" />
              <span className="font-medium text-ink-900">Drop a PDF or photo of the after-visit summary</span>
              <span className="text-primary-700 underline underline-offset-4">or choose a file</span>
              <span className="text-sm text-ink-500">PDF, JPG, PNG or HEIC, up to {MAX_MB} MB. Several photos are fine.</span>
            </label>
            <input
              ref={inputRef}
              id={ids.file}
              type="file"
              multiple
              accept="application/pdf,.pdf,image/jpeg,image/png,image/heic,image/heif,.heic,.heif,image/webp"
              className="sr-only"
              onChange={(e) => {
                if (e.target.files) addFiles(e.target.files);
                e.target.value = "";
              }}
            />
            {files.length ? (
              <ul className="mt-3 space-y-2" aria-label="Selected files">
                {files.map((f, i) => (
                  <li key={`${f.name}-${i}`} className="flex items-center gap-3 rounded-xl border border-border-200 bg-white px-3 py-2">
                    {kindOf(f) === "pdf" ? (
                      <FileText size={20} className="text-primary-700" aria-hidden="true" />
                    ) : (
                      <ImageIcon size={20} className="text-primary-700" aria-hidden="true" />
                    )}
                    <span className="min-w-0 flex-1 truncate">{f.name}</span>
                    <span className="text-sm text-ink-500">{(f.size / 1024 / 1024).toFixed(1)} MB</span>
                    <button
                      type="button"
                      className="rounded-md p-2 text-ink-500 hover:bg-surface-50 hover:text-attn"
                      aria-label={`Remove ${f.name}`}
                      onClick={() => setFiles((cur) => cur.filter((_, j) => j !== i))}
                    >
                      <X size={18} aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            <button
              type="button"
              className="mt-3 rounded-md text-primary-700 underline underline-offset-4"
              onClick={() => {
                setPasteMode(true);
                setError(null);
              }}
            >
              Paste the text instead
            </button>
          </>
        ) : (
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
              className="mt-2 rounded-md text-primary-700 underline underline-offset-4"
              onClick={() => {
                setPasteMode(false);
                setError(null);
              }}
            >
              Upload a file instead
            </button>
          </>
        )}
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
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
            className="mt-1.5 h-12 w-full rounded-xl border border-border-200 bg-white px-3 outline-none focus:border-action-500 focus:ring-2 focus:ring-action-500/30"
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
            className="mt-1.5 h-12 w-full rounded-xl border border-border-200 bg-white px-3 outline-none focus:border-action-500 focus:ring-2 focus:ring-action-500/30"
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

      <Button className="mt-6 w-full sm:w-auto sm:min-w-64" disabled={!ready} onClick={build}>
        Build the handoff
      </Button>
      <p className="mt-3 text-sm text-ink-500">
        {kind === "image"
          ? "Your photo is read on this device. Only the text is sent to build the draft, and it is not stored."
          : "Your file is read once to build the draft and is not stored."}
      </p>
    </div>
  );
}

class UserError extends Error {}
