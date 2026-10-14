import type { MetadataRoute } from "next";

import { siteUrl } from "@/lib/site";

// The signed-out surface only. A workspace URL in a sitemap would hand crawlers a sign-in wall.
const PUBLIC_PATHS = [
  "",
  "/about",
  "/blog",
  "/careers",
  "/changelog",
  "/contact",
  "/docs",
  "/docs/api",
  "/gdpr",
  "/guides",
  "/pricing",
  "/privacy",
  "/security",
  "/terms",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const origin = siteUrl();
  const lastModified = new Date();

  return PUBLIC_PATHS.map((path) => ({
    url: `${origin}${path}`,
    lastModified,
    changeFrequency: path === "/changelog" ? "weekly" : "monthly",
    priority: path === "" ? 1 : 0.6,
  }));
}
