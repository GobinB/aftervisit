import { ImageResponse } from "next/og";
import { lookup } from "@/lib/access";
import { ogTitle } from "@/lib/copy";
import { sampleDraft } from "@/lib/sample";

export const alt = "Care update";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const runtime = "nodejs";

/** Link preview for iMessage / WhatsApp: a name and a date, never medical detail. */
export default async function Image({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let title = "Care update";
  if (token === "demo") title = ogTitle(sampleDraft());
  else {
    try {
      const found = await lookup(token);
      if (found.status === "ok" && !found.row.pin_hash) title = ogTitle(found.row.payload);
    } catch {}
  }
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 80, background: "#163A6B", color: "white" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ width: 64, height: 64, borderRadius: 14, background: "#E8F1FB", color: "#1E4E8C", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 38, fontWeight: 600 }}>A</div>
          <div style={{ fontSize: 36, fontWeight: 600 }}>AfterVisit</div>
        </div>
        <div style={{ fontSize: 72, fontWeight: 600, lineHeight: 1.1 }}>{title}</div>
        <div style={{ fontSize: 30, color: "#C9DBF2" }}>Shared privately. Tap to open.</div>
      </div>
    ),
    size,
  );
}
