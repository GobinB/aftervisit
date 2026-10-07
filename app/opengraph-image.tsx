import { ImageResponse } from "next/og";

export const alt = "AfterVisit: a care handoff after every visit";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: 80, background: "#163A6B", color: "white" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ width: 72, height: 72, borderRadius: 16, background: "#E8F1FB", color: "#1E4E8C", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 44, fontWeight: 600 }}>A</div>
          <div style={{ fontSize: 44, fontWeight: 600 }}>AfterVisit</div>
        </div>
        <div style={{ marginTop: 48, fontSize: 60, lineHeight: 1.15, maxWidth: 980 }}>Turn an after-visit summary into a care handoff everyone understands.</div>
      </div>
    ),
    size,
  );
}
