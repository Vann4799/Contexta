"use client";

import { SiteIntro, SiteSection } from "@/components/public/public-shell";
import { useT } from "@/lib/i18n";

export default function BlogPage() {
  const t = useT();
  const copy = t.site.blog;

  return (
    <>
      <SiteIntro eyebrow={copy.eyebrow} title={copy.title} lede={copy.lede} />

      <SiteSection>
        <div className="space-y-12">
          {copy.posts.map((post) => (
            <article key={post.title}>
              <p className="font-mono text-[12px] text-ink-faint nums">{post.date}</p>
              <h2 className="mt-1 text-[21px] font-semibold leading-snug tracking-tight text-ink">
                {post.title}
              </h2>
              <p className="mt-2 text-[14.5px] leading-relaxed text-ink-muted">{post.excerpt}</p>
              <div className="mt-4 space-y-4 border-l-2 border-paper-line pl-5">
                {post.body.map((paragraph) => (
                  <p key={paragraph.slice(0, 32)} className="max-w-3xl text-[14.5px] leading-relaxed text-ink">
                    {paragraph}
                  </p>
                ))}
              </div>
            </article>
          ))}
        </div>
      </SiteSection>
    </>
  );
}
