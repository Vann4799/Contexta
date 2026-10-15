"use client";

import Link from "next/link";
import { SiteIntro, SiteLinkCard, SiteSection } from "@/components/public/public-shell";
import { GUIDE_SLUGS, type GuideSlug } from "@/lib/guides";
import { useHref, useT } from "@/lib/i18n";

/**
 * One task walkthrough on its own URL.
 *
 * The slug arrives from the path, but the copy lives in the locale dictionary, so the guides are
 * matched by slug rather than by index: a translation that reorders its list still shows the
 * right page.
 */
export function GuideView({ slug }: { slug: GuideSlug }) {
  const t = useT();
  const localeHref = useHref();
  const copy = t.site.guides;

  const bySlug = new Map(copy.guides.map((guide) => [guide.slug, guide]));
  const current = bySlug.get(slug);
  if (!current) return null;

  const others = GUIDE_SLUGS.filter((next) => next !== slug);

  return (
    <>
      <SiteIntro eyebrow={copy.eyebrow} title={current.title} lede={current.description} />

      <SiteSection>
        <ol className="space-y-3">
          {current.steps.map((step, index) => (
            <li key={step} className="flex gap-3">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-paper-soft font-mono text-[12px] font-semibold text-ink-muted nums">
                {index + 1}
              </span>
              <span className="text-[14.5px] leading-relaxed text-ink-muted">{step}</span>
            </li>
          ))}
        </ol>

        <div className="mt-6 flex flex-wrap items-center gap-4">
          <Link
            href={localeHref(current.href)}
            className="focus-ring inline-flex items-center rounded-control border border-paper-line bg-paper px-3.5 py-2 text-[13px] font-semibold text-ink transition-colors hover:bg-paper-soft"
          >
            {current.cta}
          </Link>
          <Link
            href={localeHref("/guides")}
            className="text-[13px] font-medium text-ink underline underline-offset-4 hover:text-ink-muted"
          >
            {copy.backToHub}
          </Link>
        </div>
      </SiteSection>

      <SiteSection title={copy.otherGuides}>
        <div className="space-y-4">
          {others.map((next) => {
            const guide = bySlug.get(next);
            if (!guide) return null;
            return (
              <SiteLinkCard
                key={next}
                title={guide.title}
                description={guide.description}
                href={`/guides/${next}`}
                cta={copy.readGuide}
              />
            );
          })}
        </div>
      </SiteSection>
    </>
  );
}

/** The hub: one card per walkthrough, linking to its page instead of inlining the steps. */
export function GuidesHub() {
  const t = useT();
  const copy = t.site.guides;

  return (
    <>
      <SiteIntro eyebrow={copy.eyebrow} title={copy.title} lede={copy.lede} />

      <SiteSection>
        <div className="space-y-4">
          {GUIDE_SLUGS.map((slug) => {
            const guide = copy.guides.find((item) => item.slug === slug);
            if (!guide) return null;
            return (
              <SiteLinkCard
                key={slug}
                title={guide.title}
                description={guide.description}
                href={`/guides/${slug}`}
                cta={copy.readGuide}
              />
            );
          })}
        </div>
      </SiteSection>
    </>
  );
}
