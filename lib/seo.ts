import type { Metadata } from "next";
import { ADMIN_EMAIL } from "@/lib/contact";
import { ASSEMBLY_CODE, MAKER } from "@/lib/site";

/**
 * Public marketing pages, in sitemap order. Private routes (/h, /i, /circles, /new, /api)
 * stay out of the sitemap, the canonicals and /llms.txt.
 */
export const PUBLIC_PAGES = [
  { path: "/", label: "Home" },
  { path: "/about", label: "About" },
  { path: "/care-teams", label: "For care teams" },
  { path: "/guides/share-the-care", label: "Sharing the care" },
  { path: "/contact", label: "Contact" },
  { path: "/privacy", label: "Privacy" },
  { path: "/privacy/health-data", label: "Health data notice" },
  { path: "/terms", label: "Terms of use" },
] as const;

/** The homepage description. The root layout and the WebSite entry share it, so they cannot drift. */
export const HOME_DESCRIPTION =
  "One shared care page for the person you look after. Family, home aides and the day program each get their own private link. Free, private by design and open source. A project of Assembly Code, a nonprofit.";

/** Origin with no trailing slash. The sitemap writes the homepage the same way. */
export function siteOrigin(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

/** Absolute URL for a public path. The homepage has no trailing slash, matching the sitemap. */
export function siteUrl(path: string): string {
  return path === "/" ? siteOrigin() : `${siteOrigin()}${path}`;
}

/** Canonical and og:url for one public page, merged with that page's own metadata. */
export function pageSeo(path: string, metadata: Metadata = {}): Metadata {
  const url = siteUrl(path);
  return {
    ...metadata,
    alternates: { ...metadata.alternates, canonical: url },
    openGraph: { ...(metadata.openGraph ?? {}), url },
  };
}

/** Escape `<` so a string in the payload cannot close the script tag. */
export function jsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

/**
 * Who runs the site, the site itself, and the free app. Facts already on the pages:
 * a free project of Assembly Code, made in Louisville, with no medical advice and no price.
 * No rating, street address or phone number: the site does not publish those.
 */
export function siteGraph() {
  const url = siteUrl("/");
  const organizationId = `${url}/#organization`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": ["Organization", "NGO"],
        "@id": organizationId,
        name: "All Hands Care",
        url,
        description: `A free project of ${ASSEMBLY_CODE.name}, a nonprofit. Made in ${MAKER.place}. A shared care page for appointments, medicines, reminders and visit notes. It does not give medical advice.`,
        email: ADMIN_EMAIL,
        location: { "@type": "Place", name: MAKER.place },
        // The apex host is the same organization as the www address linked from the site.
        sameAs: [...new Set(["https://assemblycode.org", ASSEMBLY_CODE.url])],
        parentOrganization: { "@type": "NGO", name: ASSEMBLY_CODE.name, url: ASSEMBLY_CODE.url },
      },
      {
        "@type": "WebSite",
        "@id": `${url}/#website`,
        name: "All Hands Care",
        url,
        description: HOME_DESCRIPTION,
        inLanguage: "en",
        publisher: { "@id": organizationId },
      },
      {
        "@type": "SoftwareApplication",
        "@id": `${url}/#software`,
        name: "All Hands Care",
        url,
        applicationCategory: "HealthApplication",
        operatingSystem: "Web",
        description: "A free shared care page for appointments, medicines, reminders and visit notes. It does not give medical advice.",
        isAccessibleForFree: true,
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        provider: { "@id": organizationId },
      },
    ],
  };
}

/** FAQPage from the questions already shown on the page. */
export function faqPage(path: string, items: readonly { q: string; a: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    url: siteUrl(path),
    mainEntity: items.map(({ q, a }) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
  };
}

/** HowTo from the steps already shown on the guide. */
export function howTo(path: string, name: string, description: string, steps: readonly { title: string; body: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name,
    description,
    url: siteUrl(path),
    step: steps.map((step, index) => ({
      "@type": "HowToStep",
      position: index + 1,
      name: step.title,
      text: step.body,
    })),
  };
}

/** Short plain-text summary for answer engines. Public URLs only; the private paths are named as private. */
export function llmsTxt(): string {
  return [
    "# All Hands Care",
    "",
    `> All Hands Care is a free shared care page for the person you look after: appointments, medicines, reminders and visit notes. It is a project of ${ASSEMBLY_CODE.name}, a nonprofit, made in ${MAKER.place}. It does not give medical advice.`,
    "",
    "One caregiver runs the page. Family, home aides and a day program each open their own private link. There are no ads, and information is never sold.",
    "",
    "## Public pages",
    "",
    ...PUBLIC_PAGES.map(({ path, label }) => `- ${label}: ${siteUrl(path)}`),
    "",
    "## Contact",
    "",
    ADMIN_EMAIL,
    "",
    "## Private",
    "",
    "/h/, /i/, /circles, /new, and /api are private. They are not public pages.",
    "",
  ].join("\n");
}
