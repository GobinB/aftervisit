import { describe, expect, it } from "vitest";
import sitemap from "@/app/sitemap";
import { faqPage, howTo, jsonLd, llmsTxt, pageSeo, PUBLIC_PAGES, siteGraph, siteOrigin, siteUrl } from "@/lib/seo";

function keys(value: unknown, out = new Set<string>()): Set<string> {
  if (Array.isArray(value)) for (const item of value) keys(item, out);
  else if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      out.add(key);
      keys(child, out);
    }
  }
  return out;
}

describe("public URLs", () => {
  it("matches the sitemap, with no trailing slash on the homepage", () => {
    expect(siteUrl("/")).toBe(siteOrigin());
    expect(siteUrl("/")).not.toMatch(/\/$/);
    expect(siteUrl("/privacy/health-data")).toBe(`${siteOrigin()}/privacy/health-data`);
    const entries = sitemap();
    expect(entries.map((entry) => entry.url)).toEqual(PUBLIC_PAGES.map(({ path }) => siteUrl(path)));
    expect(entries.every((entry) => entry.lastModified instanceof Date)).toBe(true);
  });

  it("sets a canonical and og:url on a page without dropping its own title", () => {
    const meta = pageSeo("/terms", { title: "Terms of use", description: "The rules for using All Hands Care." });
    expect(meta.title).toBe("Terms of use");
    expect(meta.description).toBe("The rules for using All Hands Care.");
    expect(meta.alternates).toMatchObject({ canonical: siteUrl("/terms") });
    expect(meta.openGraph).toMatchObject({ url: siteUrl("/terms") });
  });
});

describe("structured data", () => {
  it("is valid JSON for the organization, the site and the free app", () => {
    const data = JSON.parse(jsonLd(siteGraph())) as { "@context": string; "@graph": { "@type": string | string[]; offers?: { price: string } }[] };
    expect(data["@context"]).toBe("https://schema.org");
    const types = data["@graph"].map((node) => node["@type"]);
    expect(types).toContainEqual(["Organization", "NGO"]);
    expect(types).toContain("WebSite");
    expect(types).toContain("SoftwareApplication");
    const app = data["@graph"].find((node) => node["@type"] === "SoftwareApplication");
    expect(app?.offers?.price).toBe("0");
    const text = jsonLd(siteGraph());
    expect(text).toContain("https://assemblycode.org");
    expect(text).toContain("Louisville, Kentucky");
    expect(text).toContain("admin@allhandscare.org");
    const present = keys(data);
    expect(present.has("aggregateRating")).toBe(false);
    expect(present.has("telephone")).toBe(false);
    expect(present.has("streetAddress")).toBe(false);
  });

  it("escapes a closing script tag", () => {
    expect(jsonLd({ a: "</script>" })).toBe('{"a":"\\u003c/script>"}');
  });

  it("builds a FAQ page and a how-to from the copy it is given", () => {
    const faq = JSON.parse(jsonLd(faqPage("/", [{ q: "What does it cost?", a: "Nothing." }])));
    expect(faq["@type"]).toBe("FAQPage");
    expect(faq.mainEntity[0].name).toBe("What does it cost?");
    expect(faq.mainEntity[0].acceptedAnswer.text).toBe("Nothing.");
    const guide = JSON.parse(jsonLd(howTo("/guides/share-the-care", "Sharing the care", "Seven habits.", [{ title: "Keep one place", body: "Pick one place everyone can open." }])));
    expect(guide["@type"]).toBe("HowTo");
    expect(guide.step[0].position).toBe(1);
    expect(guide.step[0].name).toBe("Keep one place");
  });
});

describe("llms.txt", () => {
  it("summarizes the product, lists public URLs, and names the private paths", () => {
    const text = llmsTxt();
    expect(text).toContain("free");
    expect(text).toContain("Assembly Code");
    expect(text).toContain("Louisville, Kentucky");
    expect(text).toContain("does not give medical advice");
    expect(text).toContain("admin@allhandscare.org");
    for (const { path } of PUBLIC_PAGES) expect(text).toContain(siteUrl(path));
    expect(text).toContain("/h/, /i/, /circles, /new, and /api are private");
  });
});
