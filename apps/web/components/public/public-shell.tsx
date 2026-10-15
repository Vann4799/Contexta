"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ContextaLogo } from "@/components/contexta-logo";
import { SiteFooter } from "@/components/public/site-footer";
import { LocaleSwitch } from "@/components/public/locale-switch";
import { useHref, useT } from "@/lib/i18n";

export function PublicShell({ children }: { children: ReactNode }) {
  const t = useT();
  const localeHref = useHref();

  return (
    <div className="min-h-screen bg-paper text-ink">
      <nav className="fixed left-0 right-0 top-0 z-50 border-b border-paper-line bg-paper/80 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <Link href={localeHref("/")} className="flex items-center gap-2">
            <ContextaLogo variant="light" size={152} />
          </Link>
          <div className="hidden items-center gap-8 md:flex">
            {t.site.nav.links.map((link) => (
              <Link
                key={link.href}
                href={localeHref(link.href)}
                className="text-sm text-ink-muted transition-colors hover:text-ink"
              >
                {link.label}
              </Link>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <LocaleSwitch />
            <Link href="/login" className="text-sm font-medium text-ink transition-colors hover:text-ink-muted">
              {t.site.nav.signIn}
            </Link>
            <Link
              href="/register"
              className="rounded-control bg-night px-4 py-2 text-sm font-medium text-paper transition-colors hover:bg-night-raised"
            >
              {t.site.nav.getStarted}
            </Link>
          </div>
        </div>
      </nav>

      <main className="pt-16">{children}</main>
      <SiteFooter />
    </div>
  );
}

export function SiteIntro({ eyebrow, title, lede }: { eyebrow: string; title: string; lede: string }) {
  return (
    <section className="border-b border-paper-line bg-paper-soft">
      <div className="mx-auto max-w-3xl px-6 py-16 md:py-20">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="mt-3 text-[32px] font-semibold leading-tight tracking-tight text-ink md:text-[40px]">
          {title}
        </h1>
        <p className="mt-4 text-[16px] leading-relaxed text-ink-muted">{lede}</p>
      </div>
    </section>
  );
}

export function SiteSection({
  title,
  description,
  children,
}: {
  title?: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="mx-auto max-w-5xl px-6 py-14">
      {title ? <h2 className="text-[22px] font-semibold tracking-tight text-ink">{title}</h2> : null}
      {description ? <p className="mt-2 text-[14.5px] leading-relaxed text-ink-muted">{description}</p> : null}
      <div className={title ? "mt-6" : ""}>{children}</div>
    </section>
  );
}

export function SiteCard({
  title,
  description,
  children,
}: {
  title?: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <article className="surface h-full p-5">
      {title ? <h3 className="text-[15.5px] font-semibold tracking-tight text-ink">{title}</h3> : null}
      {description ? <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-muted">{description}</p> : null}
      {children ? <div className="mt-3">{children}</div> : null}
    </article>
  );
}

export function SiteLinkCard({
  title,
  description,
  href,
  cta,
}: {
  title: string;
  description: string;
  href: string;
  cta: string;
}) {
  const localeHref = useHref();

  return (
    <SiteCard title={title} description={description}>
      <Link
        href={localeHref(href)}
        className="text-[13.5px] font-medium text-ink underline underline-offset-4 hover:text-ink-muted"
      >
        {cta}
      </Link>
    </SiteCard>
  );
}

export function SiteList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item} className="flex gap-2.5 text-[13.5px] leading-relaxed text-ink-muted">
          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
