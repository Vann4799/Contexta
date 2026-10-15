"use client";

import Link from "next/link";
import { SiteCard, SiteIntro, SiteSection } from "@/components/public/public-shell";
import { useHref, useT } from "@/lib/i18n";

export default function GuidesPage() {
  const t = useT();
  const localeHref = useHref();
  const copy = t.site.guides;

  return (
    <>
      <SiteIntro eyebrow={copy.eyebrow} title={copy.title} lede={copy.lede} />

      <SiteSection>
        <div className="space-y-5">
          {copy.guides.map((guide) => (
            <SiteCard key={guide.href} title={guide.title} description={guide.description}>
              <ol className="space-y-2.5">
                {guide.steps.map((step, index) => (
                  <li key={step} className="flex gap-3">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-paper-soft font-mono text-[12px] font-semibold text-ink-muted nums">
                      {index + 1}
                    </span>
                    <span className="text-[13.5px] leading-relaxed text-ink-muted">{step}</span>
                  </li>
                ))}
              </ol>
              <Link
                href={localeHref(guide.href)}
                className="focus-ring mt-4 inline-flex items-center rounded-control border border-paper-line bg-paper px-3.5 py-2 text-[13px] font-semibold text-ink transition-colors hover:bg-paper-soft"
              >
                {guide.cta}
              </Link>
            </SiteCard>
          ))}
        </div>
      </SiteSection>
    </>
  );
}
