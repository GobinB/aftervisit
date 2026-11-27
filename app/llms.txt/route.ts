import { llmsTxt } from "@/lib/seo";

/** Plain-text summary for answer engines. Public pages only. */
export function GET() {
  return new Response(llmsTxt(), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
