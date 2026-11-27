import type { MetadataRoute } from "next";
import { PUBLIC_PAGES, siteUrl } from "@/lib/seo";

/** Public pages only. Links (/h, /i), the create flow and signed-in pages stay out, as robots.ts says. */
export default function sitemap(): MetadataRoute.Sitemap {
  // When these pages were last built. Search engines treat it as a hint.
  const lastModified = new Date();
  return PUBLIC_PAGES.map(({ path }) => ({ url: siteUrl(path), lastModified }));
}
