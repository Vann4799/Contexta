import type { ReactNode } from "react";
import { SiteJsonLd } from "@/components/seo/site-json-ld";
import { I18nProvider } from "@/lib/i18n";

/**
 * Indonesian public surface. The pages are the same modules English serves, imported rather than
 * duplicated, so a fix to a page lands in both languages; only the locale this subtree pins — and
 * with it the dictionary every one of those components reads — differs.
 */
export default function IndonesianLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteJsonLd />
      <I18nProvider locale="id">{children}</I18nProvider>
    </>
  );
}
