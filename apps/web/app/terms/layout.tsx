import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SiteJsonLd } from "@/components/seo/site-json-ld";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta("/terms");

export default function TermsLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteJsonLd />
      {children}
    </>
  );
}
