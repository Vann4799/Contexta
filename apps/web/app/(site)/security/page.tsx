"use client";

import Link from "next/link";
import { SiteIntro, SiteList, SiteSection } from "@/components/public/public-shell";
import { useHref, useT } from "@/lib/i18n";

export default function SecurityPage() {
  const t = useT();
  const localeHref = useHref();
  const copy = t.site.security;

  return (
    <>
      <SiteIntro eyebrow={copy.eyebrow} title={copy.title} lede={copy.lede} />

      <SiteSection title={copy.measuresTitle}>
        <div className="divide-y divide-paper-line border-y border-paper-line">
          {copy.measures.map((measure) => (
            <article key={measure.title} className="py-5">
              <h3 className="text-[15.5px] font-semibold tracking-tight text-ink">{measure.title}</h3>
              <p className="mt-1.5 max-w-3xl text-[14px] leading-relaxed text-ink-muted">{measure.body}</p>
            </article>
          ))}
        </div>
      </SiteSection>

      <SiteSection title={copy.limitsTitle}>
        <SiteList items={copy.limits} />
      </SiteSection>

      <SiteSection title={copy.disclosureTitle}>
        <p className="max-w-3xl text-[14.5px] leading-relaxed text-ink-muted">{copy.disclosureBody}</p>
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
