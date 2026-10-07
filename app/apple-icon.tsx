import { ImageResponse } from "next/og";
import { LOGO_PATHS } from "@/components/Logo";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** Home-screen icon: the mark on a full-bleed square (iOS rounds the corners). */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#1E4E8C" }}>
        <svg width="150" height="150" viewBox="0 0 48 48">
          <path d={LOGO_PATHS.check} fill="none" stroke="#FFFFFF" strokeWidth="4.6" strokeLinecap="round" strokeLinejoin="round" />
          <path d={LOGO_PATHS.arrow} fill="none" stroke="#9CC9FF" strokeWidth="4.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    ),
    size,
  );
}
