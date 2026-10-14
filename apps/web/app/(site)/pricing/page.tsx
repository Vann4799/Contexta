"use client";

import Link from "next/link";
import {
  SiteIntro,
  SiteList,
  SiteSection,
} from "@/components/public/public-shell";
import { PRICING_TIERS, formatCount, formatStorage, formatUsd } from "@/lib/pricing";
import { useT } from "@/lib/i18n";

export default function PricingPage() {
  const t = useT();
  const copy = t.site.pricing;

  const rows = [
    { key: "documents", value: (l: (typeof PRICING_TIERS)[number]["limits"]) => formatCount(l.documents) },
    { key: "storage", value: (l: (typeof PRICING_TIERS)[number]["limits"]) => formatStorage(l.storageBytes) },
    { key: "apiKeys", value: (l: (typeof PRICING_TIERS)[number]["limits"]) => formatCount(l.apiKeys) },
    {
      key: "apiRequests",
      value: (l: (typeof PRICING_TIERS)[number]["limits"]) => formatCount(l.apiRequestsPerDay),
    },
    {
      key: "chatMessages",
      value: (l: (typeof PRICING_TIERS)[number]["limits"]) => formatCount(l.chatMessagesPerDay),
    },
  ] as const;

  return (
    <>
      <SiteIntro eyebrow={copy.eyebrow} title={copy.title} lede={copy.lede} />

      <SiteSection>
        <div className="grid gap-5 md:grid-cols-3">
          {PRICING_TIERS.map((tier) => (
            <article
              key={tier.tier}
              className={`surface flex h-full flex-col p-6 ${
                tier.tier === "pro" ? "ring-1 ring-accent" : ""
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-[17px] font-semibold tracking-tight text-ink">
                  {copy.names[tier.tier]}
                </h2>
                {tier.tier === "pro" ? (
                  <span className="rounded-control bg-accent px-2 py-0.5 text-[11px] font-semibold text-accent-ink">
                    {copy.popularBadge}
                  </span>
                ) : null}
              </div>

              <p className="mt-4 font-mono text-[30px] leading-none text-ink nums">
                {tier.priceMonthly === 0 ? copy.freeForever : formatUsd(tier.priceMonthly)}
                {tier.priceMonthly !== 0 ? (
                  <span className="ml-1 font-secondary text-[13px] text-ink-muted">
                    {copy.perMonth}
                  </span>
                ) : null}
              </p>
              {tier.priceYearly > 0 ? (
                <p className="mt-1 font-secondary text-[12.5px] text-ink-faint">
                  {formatUsd(tier.priceYearly)} {copy.perYear}
                </p>
              ) : null}

              <p className="mt-4 text-[13.5px] leading-relaxed text-ink-muted">{copy.blurbs[tier.tier]}</p>

              <dl className="mt-5 divide-y divide-paper-line border-t border-paper-line">
                {rows.map((row) => (
                  <div key={row.key} className="flex items-baseline justify-between gap-3 py-2.5">
                    <dt className="text-[13px] text-ink-muted">{copy.rows[row.key]}</dt>
                    <dd className="font-mono text-[13px] text-ink nums">{row.value(tier.limits)}</dd>
                  </div>
                ))}
              </dl>

              <div className="mt-6 pt-1">
                {tier.priceMonthly === 0 ? (
                  <Link
                    href="/register"
                    className="focus-ring inline-flex w-full items-center justify-center rounded-control bg-night px-4 py-2.5 text-[13.5px] font-semibold text-paper transition-colors hover:bg-night-raised"
                  >
                    {copy.ctaFree}
                  </Link>
                ) : (
                  <Link
                    href="/login"
                    className="focus-ring inline-flex w-full items-center justify-center rounded-control border border-paper-line bg-paper px-4 py-2.5 text-[13.5px] font-semibold text-ink transition-colors hover:bg-paper-soft"
                  >
                    {copy.ctaPaid}
                  </Link>
                )}
              </div>
            </article>
          ))}
        </div>
      </SiteSection>

      <SiteSection title={copy.includedTitle}>
        <SiteList items={copy.included} />
      </SiteSection>

      <SiteSection title={copy.faqTitle}>
        <dl className="divide-y divide-paper-line border-y border-paper-line">
          {copy.faq.map((item) => (
            <div key={item.question} className="py-5">
              <dt className="text-[15px] font-semibold tracking-tight text-ink">{item.question}</dt>
              <dd className="mt-1.5 text-[14px] leading-relaxed text-ink-muted">{item.answer}</dd>
            </div>
          ))}
        </dl>
      </SiteSection>
    </>
  );
}
