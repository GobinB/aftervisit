import { Clock, Link2Off, Trash2 } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { COPY } from "@/lib/copy";

export function GonePage({ status }: { status: "expired" | "deleted" | "not_found" }) {
  const Icon = status === "expired" ? Clock : status === "deleted" ? Trash2 : Link2Off;
  const title = status === "expired" ? "This link has expired" : status === "deleted" ? "This care update was deleted" : "This link is not valid";
  const body = status === "expired" ? COPY.expired : status === "deleted" ? COPY.deleted : COPY.notFound;
  return (
    <div className="flex min-h-dvh items-center justify-center bg-surface-50 px-4">
      <main id="main" className="w-full max-w-md rounded-2xl border border-border-200 bg-white p-8 text-center shadow-sm">
        <Logo className="mx-auto" />
        <div className="mx-auto mt-6 flex h-12 w-12 items-center justify-center rounded-full bg-sky-100 text-primary-700">
          <Icon size={22} aria-hidden="true" />
        </div>
        <h1 className="mt-3 text-xl font-semibold text-primary-900">{title}</h1>
        <p className="mt-2 text-ink-500">{body}</p>
        <Link href="/" className="mt-6 inline-flex min-h-12 items-center rounded-xl px-4 font-semibold text-primary-700 underline underline-offset-4">
          Go to AfterVisit
        </Link>
      </main>
    </div>
  );
}
