import type { MetadataRoute } from "next";

import { siteUrl } from "@/lib/site";

// Only the signed-out surface is worth crawling; everything below it answers with a sign-in
// wall, which is exactly what a crawler should not index.
const PRIVATE_PATHS = [
  "activity",
  "api-keys",
  "auth",
  "billing",
  "chat",
  "convert",
  "dashboard",
  "documents",
  "forgot-password",
  "help",
  "integrations",
  "onboarding",
  "pipeline",
  "profile",
  "settings",
  "update-password",
  "usage",
  "verify-email",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: PRIVATE_PATHS.map((path) => `/${path}/`) }],
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
