"use client";

import { Printer } from "lucide-react";

/** Prints the page. `className` places it, such as below a list on phones. */
export function PrintButton({ className = "" }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className={`no-print inline-flex h-9 items-center max-sm:min-h-12 max-sm:px-4 gap-2 rounded-md border border-border-200 bg-white px-3 text-hint font-medium text-ink-900 hover:bg-paper-100 ${className}`}
    >
      <Printer className="size-4" aria-hidden="true" /> Print
    </button>
  );
}
