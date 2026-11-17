import type { MetadataRoute } from "next";

// NEXT_PUBLIC_APP_URL is set on Vercel for production and previews. Without it, a Vercel build still names
// its own production address (Vercel sets VERCEL_PROJECT_PRODUCTION_URL), never localhost.
const vercelUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "";
const appUrl = (process.env.NEXT_PUBLIC_APP_URL || vercelUrl || "http://localhost:3000").replace(/\/$/, "");

/** Lets phones install the site as an app. Icons are drawn in app/icons. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "All Hands Care",
    short_name: "All Hands Care",
    description: "One shared care page for the person you look after.",
    start_url: "/start",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#FFFFFF",
    theme_color: "#FFFFFF",
    categories: ["health", "lifestyle", "productivity"],
    // Lists the site itself, so Chrome on Android can tell the page it is already on the Home Screen
    // (navigator.getInstalledRelatedApps) and the "Add to Home Screen" button can step aside.
    related_applications: [{ platform: "webapp", url: `${appUrl}/manifest.webmanifest` }],
    prefer_related_applications: false,
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
