/**
 * The canonical public origin, shared by robots.txt, sitemap.xml and any absolute URL a
 * crawler needs. A route file must only export its handler, so this lives outside app/.
 */
export function siteUrl(): string {
  // Vercel stamps the production alias on every build; its plain deployment URL would put a
  // throwaway *-vanns-projects domain in front of Google.
  const productionAlias = process.env.VERCEL_PROJECT_PRODUCTION_URL;

  if (productionAlias) {
    return `https://${productionAlias.replace(/^https?:\/\//, "")}`;
  }

  return process.env.NODE_ENV === "production" ? "https://contexta.my.id" : "http://localhost:3000";
}

/**
 * The whole indexable surface, in one list, because four things have to agree on it: the SEO copy
 * table, the sitemap, the Indonesian route guard, and every link that needs a locale prefix.
 * The tuple type is what makes lib/seo.ts fail the build if a path here has no copy for some
 * locale, so a dangling hreflang link cannot be shipped by accident.
 */
export const PUBLIC_PATHS = [
  "/",
  "/about",
  "/blog",
  "/careers",
  "/changelog",
  "/contact",
  "/docs",
  "/docs/api",
  "/gdpr",
  "/guides",
  "/guides/upload-to-first-answer",
  "/guides/reading-a-citation",
  "/guides/using-an-api-key",
  "/guides/exporting-your-data",
  "/pricing",
  "/privacy",
  "/security",
  "/terms"
] as const;

export type PublicPath = (typeof PUBLIC_PATHS)[number];

export function isPublicPath(path: string): path is PublicPath {
  return (PUBLIC_PATHS as readonly string[]).includes(path);
}
