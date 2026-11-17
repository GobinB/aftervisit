import { ScanText, Sparkles } from "lucide-react";
import type { DraftReader } from "@/lib/store";

const CHECK = "It can make mistakes.";

/** Which reader read the summary, and to check its work. Nothing for the sample. */
export const READER_TEXT: Record<DraftReader, string> = {
  openai: `Read by AI (OpenAI). ${CHECK}`,
  builtin: `Read by All Hands Care's built-in reader. ${CHECK}`,
  device: `Read on this phone or computer by All Hands Care's built-in reader. ${CHECK}`,
};

export function ReaderNote({ reader }: { reader: DraftReader | null }) {
  if (!reader) return null;
  const Icon = reader === "openai" ? Sparkles : ScanText;
  return (
    <p data-testid="reader-note" className="mt-2 flex items-start gap-2 text-[13px] text-ink-500">
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span>{READER_TEXT[reader]}</span>
    </p>
  );
}
