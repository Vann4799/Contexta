"use client";

import { SiteIntro, SiteList, SiteSection } from "@/components/public/public-shell";
import { useT } from "@/lib/i18n";

export default function AboutPage() {
  const t = useT();
  const copy = t.site.about;

  return (
    <>
      <SiteIntro eyebrow={copy.eyebrow} title={copy.title} lede={copy.lede} />

      <SiteSection>
        <div className="divide-y divide-paper-line border-y border-paper-line">
          {copy.sections.map((section) => (
            <article key={section.title} className="py-6">
              <h2 className="text-[17px] font-semibold tracking-tight text-ink">{section.title}</h2>
              <p className="mt-2 max-w-3xl text-[14.5px] leading-relaxed text-ink-muted">{section.body}</p>
            </article>
          ))}
        </div>
      </SiteSection>

      <SiteSection title={copy.stackTitle}>
        <SiteList items={copy.stack} />
      </SiteSection>
    </>
  );
}
