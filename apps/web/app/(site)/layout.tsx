import { PublicShell } from "@/components/public/public-shell";
import { SiteJsonLd } from "@/components/seo/site-json-ld";
import type { ReactNode } from "react";

export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteJsonLd />
      <PublicShell>{children}</PublicShell>
    </>
  );
}
