import { ImageResponse } from "next/og";
import { notFound } from "next/navigation";
import { LOGO_COLORS, MarkGlyph } from "@/components/Logo";

/**
 * App icons, drawn from the same shapes as the logo and built once at deploy.
 * "icon" is the rounded tile. "maskable" fills the square so Android can crop it to any shape;
 * the mark sits well inside the center 80% circle. "badge" is the white mark for notifications.
 */
const ICONS = {
  "icon-192.png": { size: 192, kind: "icon" },
  "icon-512.png": { size: 512, kind: "icon" },
  "maskable-512.png": { size: 512, kind: "maskable" },
  "badge-96.png": { size: 96, kind: "badge" },
} as const;

type Name = keyof typeof ICONS;

export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return Object.keys(ICONS).map((name) => ({ name }));
}

export async function GET(_request: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  if (!(name in ICONS)) notFound();
  const { size, kind } = ICONS[name as Name];
  const tile = kind === "badge" ? "transparent" : LOGO_COLORS.tile;
  const radius = kind === "icon" ? Math.round((size * 13) / 48) : 0;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: size, height: size, display: "flex", alignItems: "center", justifyContent: "center", background: tile, borderRadius: radius }}>
          {kind === "badge" ? <MarkGlyph size={size} arcs="#FFFFFF" dot="#FFFFFF" /> : <MarkGlyph size={size} />}
        </div>
      </div>
    ),
    { width: size, height: size },
  );
}
