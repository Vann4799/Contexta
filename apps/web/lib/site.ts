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
