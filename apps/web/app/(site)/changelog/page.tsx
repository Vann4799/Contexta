"use client";

import { SiteIntro, SiteSection } from "@/components/public/public-shell";
import { useT } from "@/lib/i18n";

export default function ChangelogPage() {
  const t = useT();
  const copy = t.site.changelog;

  return (
    <>
      <SiteIntro eyebrow={copy.eyebrow} title={copy.title} lede={copy.lede} />

      <SiteSection>
        <ol className="relative space-y-10 border-l border-paper-line pl-6">
          {copy.entries.map((entry) => (
            <li key={`${entry.date}-${entry.title}`} className="relative">
              <span className="absolute -left-[26px] top-1.5 h-2 w-2 rounded-full bg-accent" aria-hidden="true" />
              <p className="font-mono text-[12px] text-ink-faint nums">{entry.date}</p>
              <h2 className="mt-1 text-[17px] font-semibold tracking-tight text-ink">{entry.title}</h2>
              <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-ink-muted">{entry.body}</p>
            </li>
          ))}
        </ol>
      </SiteSection>
    </>
  );
}
