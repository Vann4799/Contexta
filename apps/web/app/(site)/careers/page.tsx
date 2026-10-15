"use client";

import Link from "next/link";
import { SiteIntro, SiteList, SiteSection } from "@/components/public/public-shell";
import { useHref, useT } from "@/lib/i18n";

export default function CareersPage() {
  const t = useT();
  const localeHref = useHref();
  const copy = t.site.careers;

  return (
    <>
      <SiteIntro eyebrow={copy.eyebrow} title={copy.title} lede={copy.lede} />

      <SiteSection title={copy.lookingTitle}>
        <SiteList items={copy.looking} />
      </SiteSection>

      <SiteSection title={copy.howTitle}>
        <p className="max-w-3xl text-[14.5px] leading-relaxed text-ink-muted">{copy.howBody}</p>
        <Link
          href={localeHref("/contact")}
          className="focus-ring mt-5 inline-flex items-center rounded-control bg-night px-4 py-2.5 text-[13.5px] font-semibold text-paper transition-colors hover:bg-night-raised"
        >
          {copy.cta}
        </Link>
      </SiteSection>
    </>
  );
}
