import { ImageResponse } from "next/og";
import { MarkGlyph } from "@/components/Logo";
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
  // Keep "Oct 3" together on one line.
  title = title.replace(/ (\d)/g, "\u00a0$1");
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 80, background: "#163A6B", color: "white" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ display: "flex", width: 64, height: 64, borderRadius: 17, background: "#E8F1FB" }}>
            <MarkGlyph size={64} arcs="#1E4E8C" dot="#C2410C" />
          </div>
          <div style={{ display: "flex", fontSize: 36, fontWeight: 600 }}>
            All Hands<span style={{ color: "#C9DEF7", fontWeight: 500, marginLeft: 12 }}>Care</span>
          </div>
        </div>
        <div style={{ fontSize: 72, fontWeight: 600, lineHeight: 1.1 }}>{title}</div>
        <div style={{ fontSize: 30, color: "#C9DBF2" }}>Shared privately. Tap to open.</div>
      </div>
    ),
    size,
  );
}
