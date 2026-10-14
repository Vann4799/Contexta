"use client";

import Link from "next/link";
import { ApiReference } from "@/components/docs/api-reference";
import { SiteIntro } from "@/components/public/public-shell";
import { useT } from "@/lib/i18n";

export default function PublicApiDocsPage() {
  const t = useT();
  const copy = t.site.api;

  return (
    <>
      <SiteIntro eyebrow={copy.eyebrow} title={copy.title} lede={copy.lede} />

      <div className="mx-auto max-w-5xl px-6 py-14">
        <p className="max-w-2xl text-[14px] leading-relaxed text-ink-muted">{copy.mcpNote}</p>
        <Link
          href="/login"
          className="focus-ring mt-5 inline-flex items-center rounded-control bg-night px-4 py-2.5 text-[13.5px] font-semibold text-paper transition-colors hover:bg-night-raised"
        >
          {copy.keysCta}
        </Link>

        <div className="mt-10">
          <ApiReference showHeader={false} />
        </div>
      </div>
    </>
  );
}
