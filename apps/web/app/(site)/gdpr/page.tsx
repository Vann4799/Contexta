"use client";

import { SiteIntro, SiteList, SiteSection } from "@/components/public/public-shell";
import { useT } from "@/lib/i18n";

export default function GdprPage() {
  const t = useT();
  const copy = t.site.gdpr;

  return (
    <>
      <SiteIntro eyebrow={copy.eyebrow} title={copy.title} lede={copy.lede} />

      <SiteSection title={copy.controllerTitle}>
        <p className="max-w-3xl text-[14.5px] leading-relaxed text-ink-muted">{copy.controllerBody}</p>
      </SiteSection>

      <SiteSection title={copy.rightsTitle}>
        <div className="divide-y divide-paper-line border-y border-paper-line">
          {copy.rights.map((right) => (
            <div key={right.title} className="flex flex-col gap-1 py-4 sm:flex-row sm:gap-6">
              <h3 className="shrink-0 text-[14.5px] font-semibold tracking-tight text-ink sm:w-52">
                {right.title}
              </h3>
              <p className="text-[14px] leading-relaxed text-ink-muted">{right.body}</p>
            </div>
          ))}
        </div>
      </SiteSection>

      <SiteSection title={copy.retentionTitle}>
        <SiteList items={copy.retention} />
      </SiteSection>

      <SiteSection title={copy.subprocessorsTitle}>
        <div className="divide-y divide-paper-line border-y border-paper-line">
          {copy.subprocessors.map((item) => (
            <div key={item.name} className="flex flex-col gap-0.5 py-3.5 sm:flex-row sm:gap-6">
              <p className="shrink-0 font-mono text-[13px] text-ink sm:w-52">{item.name}</p>
              <p className="text-[13.5px] leading-relaxed text-ink-muted">{item.role}</p>
            </div>
          ))}
        </div>
      </SiteSection>

      <SiteSection>
        <p className="max-w-3xl rounded-card border border-paper-line bg-paper-soft p-4 text-[13.5px] leading-relaxed text-ink-muted">
          {copy.note}
        </p>
      </SiteSection>
    </>
  );
}
