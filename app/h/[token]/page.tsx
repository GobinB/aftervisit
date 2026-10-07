import type { Metadata } from "next";
import { DemoHandoff, LiveHandoff, PinGate } from "@/components/handoff/clients";
import { GonePage } from "@/components/handoff/GonePage";
import { lookup } from "@/lib/access";
import { ogTitle } from "@/lib/copy";
import { toView } from "@/lib/db";
import { SAMPLE_CAREGIVER, SAMPLE_RECIPIENTS, sampleDraft } from "@/lib/sample";
import type { HandoffView } from "@/lib/schema";
import { originalLink } from "@/lib/storage";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ token: string }>; searchParams: Promise<{ print?: string }> };

function demoView(): HandoffView {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { sourceText, ...payload } = sampleDraft();
  const now = Date.now();
  return {
    token: "demo",
    payload,
    createdByFirstName: SAMPLE_CAREGIVER,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + 30 * 86_400_000).toISOString(),
    recipients: SAMPLE_RECIPIENTS,
    ackCount: 0,
    hasOriginal: false,
  };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const base: Metadata = { robots: { index: false, follow: false, nocache: true }, referrer: "no-referrer" };
  let title = "Care update";
  if (token === "demo") title = ogTitle(sampleDraft());
  else {
    try {
      const found = await lookup(token);
      // With a PIN the preview names no one.
      if (found.status === "ok" && !found.row.pin_hash) title = ogTitle(found.row.payload);
    } catch {}
  }
  const description = "A care update was shared with you through AfterVisit.";
  return { ...base, title: { absolute: title }, description, openGraph: { title, description, type: "article" }, twitter: { card: "summary_large_image", title, description } };
}

export default async function HandoffPage({ params, searchParams }: Props) {
  const { token } = await params;
  const autoPrint = (await searchParams).print === "1";
  if (token === "demo") return <DemoHandoff view={demoView()} />;

  const found = await lookup(token);
  if (found.status !== "ok") return <GonePage status={found.status} />;
  if (found.row.pin_hash) return <PinGate token={token} autoPrint={autoPrint} />;

  const originalUrl = found.row.original_path ? originalLink(token) : null;
  return <LiveHandoff view={toView(found.row)} originalUrl={originalUrl} autoPrint={autoPrint} />;
}
