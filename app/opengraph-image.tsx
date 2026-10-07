import { ImageResponse } from "next/og";
import { LOGO_PATHS } from "@/components/Logo";

export const alt = "AfterVisit: share the doctor's plan with everyone who helps";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: 80, background: "#163A6B", color: "white" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <svg width="72" height="72" viewBox="0 0 48 48">
            <rect width="48" height="48" rx="13" fill="#E8F1FB" />
            <path d={LOGO_PATHS.check} fill="none" stroke="#1E4E8C" strokeWidth="4.6" strokeLinecap="round" strokeLinejoin="round" />
            <path d={LOGO_PATHS.arrow} fill="none" stroke="#2F80ED" strokeWidth="4.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div style={{ display: "flex", fontSize: 44, fontWeight: 600 }}>
            After<span style={{ color: "#C9DEF7", fontWeight: 500 }}>Visit</span>
          </div>
        </div>
        <div style={{ marginTop: 48, fontSize: 60, lineHeight: 1.15, maxWidth: 980 }}>Share the doctor&apos;s plan with everyone who helps.</div>
      </div>
    ),
    size,
  );
}
