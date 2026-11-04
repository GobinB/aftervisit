"use client";

import { Printer } from "lucide-react";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="no-print inline-flex h-9 items-center gap-2 rounded-md border border-border-200 bg-white px-3 text-[13px] font-medium text-ink-900 hover:bg-paper-100"
    >
      <Printer className="size-4" aria-hidden="true" /> Print
    </button>
  );
}
