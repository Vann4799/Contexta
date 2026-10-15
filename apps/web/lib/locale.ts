import { isPublicPath } from "@/lib/site";

export type Locale = "en" | "id";

export const localeOptions: { value: Locale; label: string }[] = [
  { value: "en", label: "English" },
  { value: "id", label: "Bahasa Indonesia" }
];

/**
 * English owns the unprefixed URL, so adding a locale never moves an existing link.
 */
export function localePath(path: string, locale: Locale): string {
  if (locale === "en") return path;
  return path === "/" ? "/id" : `/id${path}`;
}

/**
 * Keep a link on the reader's language, for the links that can.
 *
 * Only pages in PUBLIC_PATHS exist under /id, so a workspace href (/help, /documents) passes
 * through unchanged instead of 404ing, and a bare "#section" stays where it is.
 */
export function localizeHref(path: string, locale: Locale): string {
  if (path.startsWith("#")) {
    return path;
  }

  const [route, fragment] = path.split("#");
  const localized = isPublicPath(route) ? localePath(route, locale) : route;
  return fragment === undefined ? localized : `${localized}#${fragment}`;
}
