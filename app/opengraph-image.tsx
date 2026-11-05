import { ImageResponse } from "next/og";
import { brandOnDark } from "@/lib/brand-image";

export const alt = "All Hands Care: one shared care page for the person you look after";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  const brand = await brandOnDark();
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: 80, background: "#1E2A3A", color: "white" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <img src={brand.symbol} width={102} height={72} alt="" />
          <img src={brand.wordmark} width={300} height={45} alt="All Hands Care" />
        </div>
        <div style={{ marginTop: 48, fontSize: 60, lineHeight: 1.15, maxWidth: 980 }}>One shared care page for the person you look after.</div>
      </div>
    ),
    size,
  );
}
