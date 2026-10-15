/**
 * The four task walkthroughs, in the order the hub lists them.
 *
 * The slug is the URL, so it is the one thing that must never be renamed after a page has been
 * crawled; the display title lives in the locale dictionaries and can change freely.
 */
export const GUIDE_SLUGS = [
  "upload-to-first-answer",
  "reading-a-citation",
  "using-an-api-key",
  "exporting-your-data"
] as const;

export type GuideSlug = (typeof GUIDE_SLUGS)[number];

export type GuidePath = `/guides/${GuideSlug}`;

export function isGuideSlug(value: string): value is GuideSlug {
  return (GUIDE_SLUGS as readonly string[]).includes(value);
}
