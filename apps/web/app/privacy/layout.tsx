import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SiteJsonLd } from "@/components/seo/site-json-ld";
import { I18nProvider } from "@/lib/i18n";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta("/privacy");

export default function PrivacyLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteJsonLd />
      <I18nProvider locale="en">{children}</I18nProvider>
    </>
  );
}
