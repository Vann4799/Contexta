"use client";

import Link from "next/link";
import { SiteIntro, SiteLinkCard, SiteSection } from "@/components/public/public-shell";
import { useT } from "@/lib/i18n";

export default function DocsPage() {
  const t = useT();
  const copy = t.site.docs;

  return (
    <>
      <SiteIntro eyebrow={copy.eyebrow} title={copy.title} lede={copy.lede} />

      <SiteSection title={copy.startTitle}>
        <ol className="space-y-3">
          {copy.start.map((step, index) => (
            <li key={step} className="flex gap-3">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent font-mono text-[12px] font-semibold text-accent-ink nums">
                {index + 1}
              </span>
              <span className="max-w-3xl text-[14px] leading-relaxed text-ink-muted">{step}</span>
            </li>
          ))}
        </ol>
        <Link
          href="/register"
          className="focus-ring mt-6 inline-flex items-center rounded-control bg-night px-4 py-2.5 text-[13.5px] font-semibold text-paper transition-colors hover:bg-night-raised"
        >
          {copy.startCta}
        </Link>
      </SiteSection>

      <SiteSection title={copy.cardsTitle}>
        <div className="space-y-4">
          {copy.cards.map((card) => (
            <SiteLinkCard
              key={card.href}
              title={card.title}
              description={card.description}
              href={card.href}
              cta={card.cta}
            />
          ))}
        </div>
      </SiteSection>
    </>
  );
}
