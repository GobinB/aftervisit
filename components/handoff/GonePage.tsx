import { Clock, Link2Off, Lock, Trash2, UserX } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { COPY } from "@/lib/copy";

export type GoneStatus = "expired" | "deleted" | "not_found" | "invite_only" | "revoked";

const CONTENT: Record<GoneStatus, { icon: typeof Clock; title: string; body: string }> = {
  expired: { icon: Clock, title: "This link has expired", body: COPY.expired },
  deleted: { icon: Trash2, title: "This care update was deleted", body: COPY.deleted },
  not_found: { icon: Link2Off, title: "This link is not valid", body: COPY.notFound },
  invite_only: {
    icon: Lock,
    title: "This care update uses personal links",
    body: "Each person it was shared with has their own link. Ask the person who shared it to send you yours.",
  },
  revoked: {
    icon: UserX,
    title: "Your access was removed",
    body: "The person who shared this care update removed access for this link. Ask them if you think this is a mistake.",
  },
};

export function GonePage({ status }: { status: GoneStatus }) {
  const { icon: Icon, title, body } = CONTENT[status];
  return (
    <div className="flex min-h-dvh items-center justify-center bg-surface-50 px-4">
      <main id="main" className="w-full max-w-md rounded-2xl border border-border-200 bg-white p-8 text-center shadow-sm">
        <Logo className="mx-auto" />
        <div className="mx-auto mt-6 flex h-12 w-12 items-center justify-center rounded-full bg-sky-100 text-primary-700">
          <Icon size={22} aria-hidden="true" />
        </div>
        <h1 className="font-display mt-3 text-[1.6rem] leading-tight font-medium text-primary-900">{title}</h1>
        <p className="mt-2 text-ink-500">{body}</p>
        <Link href="/" className="mt-6 inline-flex min-h-12 items-center rounded-xl px-4 font-semibold text-primary-700 underline underline-offset-4">
          Go to AfterVisit
        </Link>
      </main>
    </div>
  );
}
