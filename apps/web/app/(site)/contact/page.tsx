"use client";

import Link from "next/link";
import { SiteCard, SiteIntro, SiteSection } from "@/components/public/public-shell";
import { useT } from "@/lib/i18n";

export default function ContactPage() {
  const t = useT();
  const copy = t.site.contact;

  return (
    <>
      <SiteIntro eyebrow={copy.eyebrow} title={copy.title} lede={copy.lede} />

      <SiteSection title={copy.channelsTitle}>
        <div className="space-y-4">
          {copy.channels.map((channel) => (
            <SiteCard key={channel.title} title={channel.title} description={channel.body}>
              <Link
                href={channel.href}
                className="focus-ring inline-flex items-center rounded-control border border-paper-line bg-paper px-3.5 py-2 text-[13px] font-semibold text-ink transition-colors hover:bg-paper-soft"
              >
                {channel.cta}
              </Link>
            </SiteCard>
          ))}
        </div>
      </SiteSection>

      <SiteSection title={copy.securityTitle}>
        <p className="max-w-3xl text-[14.5px] leading-relaxed text-ink-muted">{copy.securityBody}</p>
        <Link
          href="/security"
          className="focus-ring mt-5 inline-flex items-center rounded-control bg-night px-4 py-2.5 text-[13.5px] font-semibold text-paper transition-colors hover:bg-night-raised"
        >
          {copy.securityCta}
        </Link>
      </SiteSection>
    </>
  );
}
