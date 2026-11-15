import { Phone } from "lucide-react";
import { telHref } from "@/lib/phone";

/**
 * Tap to call. On a phone it opens the dialer with the number filled in; printed, it is the number
 * in plain text. Text with no number in it is shown as written, without a button.
 */
export function CallButton({ phone, name, size = "large" }: { phone: string; name: string; size?: "large" | "small" }) {
  const href = telHref(phone);
  if (!href) return <span className="text-[15px] text-ink-900">{phone}</span>;
  const shape =
    size === "large"
      ? "min-h-14 w-full justify-center rounded-xl px-4 text-[17px] sm:w-auto sm:min-w-60"
      : "min-h-11 shrink-0 rounded-lg px-3 text-[14px]";
  return (
    <a
      href={href}
      aria-label={`Call ${name}, ${phone}`}
      className={`print-plain inline-flex items-center gap-2 bg-primary-700 font-semibold text-white tabular-nums hover:bg-primary-900 ${shape}`}
    >
      <Phone className={size === "large" ? "size-5" : "size-4"} aria-hidden="true" />
      <span>
        <span className="no-print">Call </span>
        {phone}
      </span>
    </a>
  );
}
