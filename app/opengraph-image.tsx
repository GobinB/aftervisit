import { ImageResponse } from "next/og";
import { MarkGlyph } from "@/components/Logo";

export const alt = "All Hands Care: one shared care page for the person you look after";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: 80, background: "#163A6B", color: "white" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ display: "flex", width: 72, height: 72, borderRadius: 20, background: "#E8F1FB" }}>
            <MarkGlyph size={72} arcs="#1E4E8C" dot="#E5644E" />
          </div>
          <div style={{ display: "flex", fontSize: 44, fontWeight: 600 }}>
            All Hands<span style={{ color: "#C9DEF7", fontWeight: 500, marginLeft: 12 }}>Care</span>
          </div>
        </div>
        <div style={{ marginTop: 48, fontSize: 60, lineHeight: 1.15, maxWidth: 980 }}>One shared care page for the person you look after.</div>
      </div>
    ),
    size,
  );
}
