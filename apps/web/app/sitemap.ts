import type { MetadataRoute } from "next";

import { localePath } from "@/lib/locale";
import { PUBLIC_PATHS, siteUrl } from "@/lib/site";

/**
 * Both languages of every indexable page, because each of those pages advertises the other as its
 * hreflang twin. A sitemap listing only English while the pages point at /id would contradict
 * itself, and a crawler would treat the Indonesian half as orphaned.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const origin = siteUrl();

  // No lastModified: a date stamped per request would claim every page changed today, and an
  // inaccurate lastmod teaches the crawler to distrust the field.
  return PUBLIC_PATHS.flatMap((path) =>
    (["en", "id"] as const).map((locale) => {
      const suffix = localePath(path, locale);
      return {
        // The home page's canonical renders without a trailing slash; `/` here would make the two
        // files disagree about which URL the page is.
        url: suffix === "/" ? origin : `${origin}${suffix}`,
        changeFrequency: path === "/changelog" ? "weekly" : "monthly",
        priority: path === "/" ? 1 : 0.6
      };
    })
  );
}
