import type { MetadataRoute } from "next";

import { PUBLIC_PATHS } from "@/lib/seo";
import { siteUrl } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const origin = siteUrl();

  // No lastModified: a date stamped per request would claim every page changed today, and an
  // inaccurate lastmod teaches the crawler to distrust the field.
  return PUBLIC_PATHS.map((path) => ({
    // The home page's canonical is rendered without a trailing slash; a `/` here would make the
    // two files disagree about which URL the page is.
    url: path === "/" ? origin : `${origin}${path}`,
    changeFrequency: path === "/changelog" ? "weekly" : "monthly",
    priority: path === "/" ? 1 : 0.6,
  }));
}
