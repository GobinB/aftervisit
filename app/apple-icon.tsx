import { ImageResponse } from "next/og";
import { LOGO_COLORS, MarkGlyph } from "@/components/Logo";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** Home-screen icon: the mark on a full-bleed square (iOS rounds the corners). */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: LOGO_COLORS.tile }}>
        <MarkGlyph size={180} />
      </div>
    ),
    size,
  );
}
