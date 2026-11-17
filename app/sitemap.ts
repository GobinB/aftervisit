import type { MetadataRoute } from "next";
import { env } from "@/lib/env";

/** Public pages only. Links (/h, /i), the create flow and signed-in pages stay out, as robots.ts says. */
const PAGES = ["/", "/about", "/care-teams", "/guides/share-the-care", "/contact", "/privacy", "/privacy/health-data", "/terms"];

export default function sitemap(): MetadataRoute.Sitemap {
  return PAGES.map((path) => ({ url: `${env.appUrl}${path === "/" ? "" : path}` }));
}
