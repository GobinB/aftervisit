import type { MetadataRoute } from "next";

/** Lets phones install the site as an app. Icons are drawn in app/icons. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "All Hands Care",
    short_name: "All Hands",
    description: "One shared care page for the person you look after.",
    start_url: "/start",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#FFFFFF",
    theme_color: "#FFFFFF",
    categories: ["health", "lifestyle", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
