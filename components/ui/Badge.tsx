import type { MedicationChange } from "@/lib/schema";

type Tone = "med" | "attn" | "ok" | "muted" | "blue";
const tones: Record<Tone, string> = {
  med: "bg-med-bg text-med-ink",
  attn: "bg-attn-bg text-attn-ink",
  ok: "bg-ok-bg text-ok-ink",
  muted: "bg-surface-50 text-ink-500 ring-1 ring-border-200",
  blue: "bg-sky-100 text-primary-900",
};

export function Badge({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold uppercase tracking-wider whitespace-nowrap ${tones[tone]}`}>
      {children}
    </span>
  );
}

export const MED_KIND_LABEL: Record<MedicationChange["kind"], string> = {
  new: "New",
  stopped: "Stopped",
  dose_changed: "Dose changed",
  continue: "Continue",
};

export function MedBadge({ kind }: { kind: MedicationChange["kind"] }) {
  return <Badge tone={kind === "continue" ? "muted" : kind === "stopped" ? "attn" : "med"}>{MED_KIND_LABEL[kind]}</Badge>;
}
