import { TriangleAlert } from "lucide-react";
import { DEMO_MODE, DEMO_NOTICE } from "@/lib/demo";

export function DemoNotice({ className = "" }: { className?: string }) {
  if (!DEMO_MODE) return null;
  return (
    <p role="note" className={`flex gap-3 rounded-xl border border-med/30 bg-med-bg px-4 py-3 text-[0.95rem] text-med-ink ${className}`}>
      <TriangleAlert size={20} className="mt-0.5 shrink-0" aria-hidden="true" />
      <span>{DEMO_NOTICE}</span>
    </p>
  );
}
