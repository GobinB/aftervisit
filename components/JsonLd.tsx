import { jsonLd } from "@/lib/seo";

/**
 * Structured data in the page HTML. The site Content-Security-Policy allows it:
 * script-src includes 'unsafe-inline' (next.config.ts). Crawlers read the JSON; it does not run.
 */
export function JsonLd({ data }: { data: object }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(data) }} />;
}
