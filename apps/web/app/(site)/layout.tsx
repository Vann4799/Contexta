import { PublicShell } from "@/components/public/public-shell";
import { SiteJsonLd } from "@/components/seo/site-json-ld";
import { I18nProvider } from "@/lib/i18n";
import type { ReactNode } from "react";

export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteJsonLd />
      {/* The URL owns a public page's language: /about is English even for a visitor whose stored
          preference is Indonesian, otherwise the body would contradict its own hreflang tag. */}
      <I18nProvider locale="en">
        <PublicShell>{children}</PublicShell>
      </I18nProvider>
    </>
  );
}
